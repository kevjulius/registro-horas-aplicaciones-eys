-- Corrige recursion en politicas RLS de profiles/time_entries.
-- Ejecutar en Supabase SQL Editor.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.current_resource_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select resource_name
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'administracion', false)
$$;

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

drop policy if exists "profiles read own or admin" on public.profiles;

create policy "profiles read own or admin" on public.profiles
for select using (
  id = auth.uid()
  or public.is_admin()
);

drop policy if exists "entries read own or admin" on public.time_entries;
drop policy if exists "entries insert own or admin" on public.time_entries;
drop policy if exists "entries update own or admin" on public.time_entries;
drop policy if exists "entries delete own or admin" on public.time_entries;

create policy "entries read own or admin" on public.time_entries
for select using (
  recurso in (select resource_name from public.current_visible_resource_names())
  or public.is_admin()
);

create policy "entries insert own or admin" on public.time_entries
for insert with check (
  recurso = public.current_resource_name()
  or public.is_admin()
);

create policy "entries update own or admin" on public.time_entries
for update using (
  recurso = public.current_resource_name()
  or public.is_admin()
);

create policy "entries delete own or admin" on public.time_entries
for delete using (
  recurso = public.current_resource_name()
  or public.is_admin()
);
