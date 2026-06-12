-- Agrega miniequipos y permisos de lectura por equipo.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_teams (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (profile_id, team_id)
);

create table if not exists public.resource_teams (
  resource_name text not null references public.resources(name) on update cascade on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (resource_name, team_id)
);

alter table public.teams enable row level security;
alter table public.profile_teams enable row level security;
alter table public.resource_teams enable row level security;

create or replace function public.current_visible_resource_names()
returns table(resource_name text)
language sql
stable
security definer
set search_path = public
as $$
  select public.current_resource_name()
  where public.current_resource_name() is not null
  union
  select rt.resource_name
  from public.profile_teams pt
  join public.teams t on t.id = pt.team_id and t.active = true
  join public.resource_teams rt on rt.team_id = pt.team_id
  where pt.profile_id = auth.uid()
$$;

drop policy if exists "teams read admin" on public.teams;
drop policy if exists "profile teams read admin" on public.profile_teams;
drop policy if exists "resource teams read admin" on public.resource_teams;

create policy "teams read admin" on public.teams for select using (public.is_admin());
create policy "profile teams read admin" on public.profile_teams for select using (public.is_admin());
create policy "resource teams read admin" on public.resource_teams for select using (public.is_admin());

drop policy if exists "entries read own or admin" on public.time_entries;

create policy "entries read own or admin" on public.time_entries
for select using (
  recurso in (select resource_name from public.current_visible_resource_names())
  or public.is_admin()
);
