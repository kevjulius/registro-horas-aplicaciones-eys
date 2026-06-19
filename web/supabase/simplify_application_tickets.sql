-- Simplifica el flujo de tickets de Aplicaciones.
-- Ejecutar en Supabase SQL Editor despues de add_tickets.sql.

alter table public.tickets
  add column if not exists subcategoria_atencion text not null default '',
  add column if not exists en_servicio text not null default 'No',
  add column if not exists aplicativo_se_encuentra text not null default 'Si';

alter table public.tickets
  drop constraint if exists tickets_en_servicio_check;

alter table public.tickets
  add constraint tickets_en_servicio_check
  check (en_servicio in ('Si', 'No'));

alter table public.tickets
  drop constraint if exists tickets_aplicativo_operativo_check;

alter table public.tickets
  add constraint tickets_aplicativo_operativo_check
  check (aplicativo_se_encuentra in ('Si', 'No'));

update public.tickets
set
  approval_status = 'Aprobado',
  rejection_reason = '',
  subcategoria_atencion = coalesce(nullif(subcategoria_atencion, ''), ''),
  en_servicio = coalesce(nullif(en_servicio, ''), 'No'),
  aplicativo_se_encuentra = coalesce(nullif(aplicativo_se_encuentra, ''), 'Si')
where active = true;

create table if not exists public.team_applications (
  team_id uuid not null references public.teams(id) on delete cascade,
  application_name text not null references public.applications(name) on update cascade on delete cascade,
  primary key (team_id, application_name)
);

alter table public.team_applications enable row level security;

create or replace function public.current_visible_application_names()
returns table(application_name text)
language sql
stable
security definer
set search_path = public
as $$
  select ta.application_name
  from public.profile_teams pt
  join public.teams t on t.id = pt.team_id and t.active = true
  join public.team_applications ta on ta.team_id = pt.team_id
  where pt.profile_id = auth.uid()
$$;

drop policy if exists "team applications read admin" on public.team_applications;
create policy "team applications read admin" on public.team_applications for select using (public.is_admin());

create table if not exists public.attention_type_rules (
  tipo_atencion text primary key,
  max_dias integer check (max_dias is null or max_dias > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.attention_type_rules (tipo_atencion, max_dias, active)
values ('Soporte', 15, true)
on conflict (tipo_atencion) do update
set max_dias = excluded.max_dias,
    active = excluded.active,
    updated_at = now();

alter table public.attention_type_rules enable row level security;

drop policy if exists "attention rules read authenticated" on public.attention_type_rules;
create policy "attention rules read authenticated" on public.attention_type_rules for select to authenticated using (true);
