-- Ejecutar despues de add_project_ideas.sql. Incluye las columnas de edicion anteriores.
-- No modifica los tickets ni reinicia correlativos.
begin;

alter table public.project_ideas
  add column if not exists horas_reales numeric(12,2) check (horas_reales >= 0),
  add column if not exists alcance_proyecto text check (alcance_proyecto is null or btrim(alcance_proyecto) <> ''),
  add column if not exists titulo_correo text check (titulo_correo is null or btrim(titulo_correo) <> ''),
  add column if not exists sociedad text check (sociedad is null or btrim(sociedad) <> ''),
  add column if not exists usuario_solicitante text check (usuario_solicitante is null or btrim(usuario_solicitante) <> ''),
  add column if not exists responsables text[] check (responsables is null or (cardinality(responsables) > 0 and array_position(responsables, null) is null)),
  add column if not exists fecha_envio_estimacion date,
  add column if not exists fecha_envio_cotizacion date,
  add column if not exists proveedor_externo boolean not null default false,
  add column if not exists prioridad boolean not null default false;

alter table public.project_ideas drop constraint if exists project_ideas_estado_cotizacion_check;
alter table public.project_ideas add constraint project_ideas_estado_cotizacion_check
  check (estado_cotizacion in ('Por entregar', 'Por aprobar', 'Aprobado', 'Observada'));

alter table public.project_ideas enable row level security;
drop policy if exists "project ideas read manager" on public.project_ideas;
create policy "project ideas read manager" on public.project_ideas for select to authenticated
  using (public.current_profile_role() in ('consulta_proyectos', 'administracion'));
drop policy if exists "project ideas update manager" on public.project_ideas;
create policy "project ideas update manager" on public.project_ideas for update to authenticated
  using (public.current_profile_role() in ('consulta_proyectos', 'administracion'))
  with check (public.current_profile_role() in ('consulta_proyectos', 'administracion'));

-- La pertenencia se determina por el creador del ticket, no por sus responsables editables.
create or replace function public.current_leader_can_read_project_idea(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profile_teams leader_team
    join public.teams team on team.id = leader_team.team_id and team.active
    join public.profiles leader on leader.id = leader_team.profile_id and leader.active
    join public.profile_teams creator_team on creator_team.team_id = leader_team.team_id
    join public.tickets ticket on ticket.requested_by = creator_team.profile_id
    where leader_team.profile_id = auth.uid() and leader_team.is_leader
      and leader.role in ('trabajador', 'trabajador_aplicaciones', 'administracion')
      and ticket.id = p_ticket_id
  )
$$;
revoke all on function public.current_leader_can_read_project_idea(uuid) from public, anon;
grant execute on function public.current_leader_can_read_project_idea(uuid) to authenticated;

drop policy if exists "project ideas read team leader" on public.project_ideas;
create policy "project ideas read team leader" on public.project_ideas for select to authenticated
  using (public.current_leader_can_read_project_idea(ticket_id));

-- REVOKE UPDATE tambien retira permisos por columna; restaurar siempre la lista completa.
revoke update on public.project_ideas from authenticated;
grant select on public.project_ideas to authenticated;
grant update (alcance_proyecto, titulo_correo, sociedad, usuario_solicitante, responsables,
  horas_estimacion, horas_reales, costo_cotizacion, estado_cotizacion, fecha_inicio, fecha_fin, estado_atencion, bloqueantes,
  fecha_envio_estimacion, fecha_envio_cotizacion, proveedor_externo, prioridad)
  on public.project_ideas to authenticated;

notify pgrst, 'reload schema';
commit;
