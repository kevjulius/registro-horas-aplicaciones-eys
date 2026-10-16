-- Ideas de Proyecto. Ejecutar despues de add_teams.sql y simplify_application_tickets.sql.
-- No modifica ni genera ideas para tickets historicos.
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('trabajador', 'trabajador_aplicaciones', 'trabajador_bi', 'adminbi', 'administracion', 'consulta_proyectos'));

alter table public.profile_teams add column if not exists is_leader boolean not null default false;
alter table public.tickets add column if not exists alcance_proyecto text not null default '';

create or replace function public.profile_can_plan_projects(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profile_teams pt
    join public.teams t on t.id = pt.team_id and t.active
    join public.profiles p on p.id = pt.profile_id and p.active
    where pt.profile_id = p_profile_id and pt.is_leader
      and p.role in ('trabajador', 'trabajador_aplicaciones', 'administracion')
  )
$$;
revoke all on function public.profile_can_plan_projects(uuid) from public, anon, authenticated;
grant execute on function public.profile_can_plan_projects(uuid) to service_role;

create or replace function public.current_profile_can_plan_projects()
returns boolean language sql stable security definer set search_path = public as $$
  select public.profile_can_plan_projects(auth.uid())
$$;
revoke all on function public.current_profile_can_plan_projects() from public, anon;
grant execute on function public.current_profile_can_plan_projects() to authenticated;

create sequence if not exists public.project_idea_number_seq;
create table if not exists public.project_ideas (
  id uuid primary key default gen_random_uuid(),
  idea_number bigint not null unique default nextval('public.project_idea_number_seq'),
  correlativo text generated always as ('IDEA' || lpad(idea_number::text, greatest(4, length(idea_number::text)), '0')) stored unique,
  ticket_id uuid not null unique references public.tickets(id) on delete restrict,
  horas_estimacion numeric(12,2) check (horas_estimacion >= 0),
  costo_cotizacion numeric(12,2) check (costo_cotizacion >= 0),
  estado_cotizacion text not null default 'Por entregar'
    check (estado_cotizacion in ('Por entregar', 'Por aprobar', 'Aprobado')),
  fecha_inicio date,
  fecha_fin date,
  estado_atencion text not null default 'Por aprobar cotizacion'
    check (estado_atencion in ('Por aprobar cotizacion', 'Por iniciar', 'En analisis', 'En desarrollo', 'En pruebas', 'En pase a produccion', 'Cerrado')),
  bloqueantes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio)
);
alter table public.project_ideas enable row level security;

drop policy if exists "project ideas read manager" on public.project_ideas;
create policy "project ideas read manager" on public.project_ideas for select to authenticated
  using (public.current_profile_role() in ('consulta_proyectos', 'administracion'));
drop policy if exists "project ideas update manager" on public.project_ideas;
create policy "project ideas update manager" on public.project_ideas for update to authenticated
  using (public.current_profile_role() = 'consulta_proyectos')
  with check (public.current_profile_role() = 'consulta_proyectos');
revoke all on public.project_ideas from anon, authenticated;
grant select on public.project_ideas to authenticated;
grant select on public.project_ideas to service_role;
grant update (horas_estimacion, costo_cotizacion, estado_cotizacion, fecha_inicio, fecha_fin, estado_atencion, bloqueantes)
  on public.project_ideas to authenticated;

create or replace function public.stamp_project_idea_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
drop trigger if exists stamp_project_idea_update on public.project_ideas;
create trigger stamp_project_idea_update before update on public.project_ideas
  for each row execute function public.stamp_project_idea_update();

create or replace function public.is_project_planning(p_type text, p_subcategory text)
returns boolean language sql immutable set search_path = public as $$
  select lower(btrim(p_type)) = 'anteproyecto'
    and translate(lower(btrim(p_subcategory)), 'áéíóú', 'aeiou') = 'planificacion'
$$;

insert into public.attention_types(name, type, classification, active)
select 'Anteproyecto - Planificación', 'Anteproyecto', 'Planificación', true
where not exists (
  select 1 from public.attention_types
  where active and public.is_project_planning(coalesce(type, split_part(name, ' - ', 1)),
    coalesce(classification, substring(name from position(' - ' in name) + 3)))
)
on conflict (name) do update set type = excluded.type, classification = excluded.classification, active = true;

create or replace function public.guard_project_planning_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  was_planning boolean := false;
  needs_idea boolean;
begin
  if tg_op = 'UPDATE' then
    was_planning := public.is_project_planning(old.tipo_atencion, old.subcategoria_atencion);
    if exists (select 1 from public.project_ideas where ticket_id = old.id)
      and not public.is_project_planning(new.tipo_atencion, new.subcategoria_atencion) then
      raise exception 'Un ticket vinculado a una idea debe conservar Anteproyecto - Planificacion.';
    end if;
  end if;
  needs_idea := public.is_project_planning(new.tipo_atencion, new.subcategoria_atencion);
  if needs_idea and (tg_op = 'INSERT' or not was_planning
    or exists (select 1 from public.project_ideas where ticket_id = new.id)) then
    if coalesce(btrim(new.alcance_proyecto), '') = '' or coalesce(btrim(new.subject_correo), '') = '' then
      raise exception 'Alcance Proyecto y Titulo de Correo son obligatorios.';
    end if;
    if (tg_op = 'INSERT' or not was_planning) and not public.profile_can_plan_projects(new.requested_by) then
      raise exception 'Solo los lideres de equipo pueden crear Anteproyecto - Planificacion.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_project_planning_ticket on public.tickets;
create trigger guard_project_planning_ticket before insert or update on public.tickets
  for each row execute function public.guard_project_planning_ticket();

create or replace function public.create_idea_for_planning_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_project_planning(new.tipo_atencion, new.subcategoria_atencion)
    and (tg_op = 'INSERT' or not public.is_project_planning(old.tipo_atencion, old.subcategoria_atencion)) then
    insert into public.project_ideas(ticket_id) values (new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists create_idea_for_planning_ticket on public.tickets;
create trigger create_idea_for_planning_ticket after insert or update on public.tickets
  for each row execute function public.create_idea_for_planning_ticket();

-- La API valida al actor; esta funcion guarda ticket, idea y responsables en una transaccion.
create or replace function public.create_project_planning_ticket(p_ticket jsonb, p_responsables text[], p_creator uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  saved_id uuid;
begin
  if not public.profile_can_plan_projects(p_creator) then
    raise exception 'Solo los lideres de equipo pueden crear Anteproyecto - Planificacion.';
  end if;
  if not public.is_project_planning(p_ticket->>'tipo_atencion', p_ticket->>'subcategoria_atencion') then
    raise exception 'El ticket debe ser Anteproyecto - Planificacion.';
  end if;
  if coalesce(cardinality(p_responsables), 0) = 0 then
    raise exception 'Selecciona al menos un responsable.';
  end if;
  insert into public.tickets (
    codigo_tck, fecha_solicitud, sistema, formato, usuario_solicitante,
    fecha_recepcion, subject_correo, alcance_correo, alcance_proyecto,
    tipo_atencion, subcategoria_atencion, estado, fecha_termino, tipo_tck,
    en_servicio, aplicativo_se_encuentra, approval_status, rejection_reason, requested_by, active
  ) values (
    p_ticket->>'codigo_tck', (p_ticket->>'fecha_solicitud')::date, p_ticket->>'sistema',
    p_ticket->>'formato', p_ticket->>'usuario_solicitante', (p_ticket->>'fecha_recepcion')::date,
    p_ticket->>'subject_correo', p_ticket->>'alcance_correo', p_ticket->>'alcance_proyecto',
    p_ticket->>'tipo_atencion', p_ticket->>'subcategoria_atencion', p_ticket->>'estado',
    (p_ticket->>'fecha_termino')::date, case when cardinality(p_responsables) > 1 then 'Grupal' else 'Personal' end,
    p_ticket->>'en_servicio', p_ticket->>'aplicativo_se_encuentra', 'Aprobado', '', p_creator, true
  ) returning id into saved_id;
  insert into public.ticket_responsables(ticket_id, resource_name)
    select saved_id, resource_name from unnest(p_responsables) as resource_name;
  return saved_id;
end;
$$;
revoke all on function public.create_project_planning_ticket(jsonb, text[], uuid) from public, anon, authenticated;
grant execute on function public.create_project_planning_ticket(jsonb, text[], uuid) to service_role;

-- El nuevo rol solo accede a ideas; estas politicas tambien cubren consultas directas a Supabase.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'tickets', 'ticket_responsables', 'time_entries', 'bi_entries', 'resources', 'reporter_users',
    'applications', 'companies', 'attention_types', 'attention_type_rules', 'teams', 'profile_teams',
    'resource_teams', 'team_applications', 'bi_resources', 'bi_services', 'bi_attention_types',
    'bi_formats', 'bi_states', 'application_budgets', 'dashboard_expected_hours'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists "project manager isolated" on public.%I', table_name);
      execute format('create policy "project manager isolated" on public.%I as restrictive for all to authenticated using (coalesce(public.current_profile_role() <> ''consulta_proyectos'', false)) with check (coalesce(public.current_profile_role() <> ''consulta_proyectos'', false))', table_name);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
