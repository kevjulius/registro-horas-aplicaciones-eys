create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('trabajador', 'administracion')),
  resource_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.resources (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true
);

create table public.reporter_users (
  id bigint generated always as identity primary key,
  name text not null unique,
  user_type text,
  active boolean not null default true
);

create table public.companies (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true
);

create table public.applications (
  id bigint generated always as identity primary key,
  name text not null unique,
  company text,
  service text,
  fecha_creacion date,
  active boolean not null default true
);

create table public.attention_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  type text,
  classification text,
  active boolean not null default true
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profile_teams (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (profile_id, team_id)
);

create table public.resource_teams (
  resource_name text not null references public.resources(name) on update cascade on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  primary key (resource_name, team_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  codigo_tck text not null unique,
  fecha_solicitud date not null,
  sistema text not null,
  formato text not null,
  usuario_solicitante text not null,
  fecha_recepcion date not null,
  subject_correo text not null,
  alcance_correo text not null,
  tipo_atencion text not null check (tipo_atencion in ('Requerimiento', 'Proyecto', 'Anteproyecto', 'Soporte', 'Monitoreo', 'Incidencia', 'Actividades Internas')),
  estado text not null check (estado in ('Cerrado', 'Pendiente', 'En Proceso', 'Cancelado')),
  fecha_termino date not null,
  tipo_tck text not null check (tipo_tck in ('Personal', 'Grupal')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_responsables (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  resource_name text not null references public.resources(name) on update cascade on delete restrict,
  primary key (ticket_id, resource_name)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  fecha_reporte date not null,
  codigo_tck text not null,
  usuario_reporta text not null,
  recurso text not null,
  aplicativo text not null,
  fecha_inicio date not null,
  fecha_fin date,
  descripcion text,
  sociedad text not null,
  tipo_atencion text not null,
  horas_invertidas numeric not null check (horas_invertidas > 0 and horas_invertidas <= 8),
  estado_tck text not null check (estado_tck in ('En Proceso', 'Cerrado', 'Pendiente')),
  en_servicio text not null check (en_servicio in ('Si', 'No')),
  aplicativo_se_encuentra text not null check (aplicativo_se_encuentra in ('Si', 'No')),
  created_by uuid references auth.users(id),
  modificado timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.resources enable row level security;
alter table public.reporter_users enable row level security;
alter table public.companies enable row level security;
alter table public.applications enable row level security;
alter table public.attention_types enable row level security;
alter table public.teams enable row level security;
alter table public.profile_teams enable row level security;
alter table public.resource_teams enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_responsables enable row level security;
alter table public.time_entries enable row level security;

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

create or replace function public.current_ticket_ids()
returns table(ticket_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select tr.ticket_id
  from public.ticket_responsables tr
  where tr.resource_name = public.current_resource_name()
$$;

create policy "profiles read own or admin" on public.profiles
for select using (
  id = auth.uid()
  or public.is_admin()
);

create policy "masters read authenticated" on public.resources for select to authenticated using (true);
create policy "reporters read authenticated" on public.reporter_users for select to authenticated using (true);
create policy "companies read authenticated" on public.companies for select to authenticated using (true);
create policy "apps read authenticated" on public.applications for select to authenticated using (true);
create policy "attention read authenticated" on public.attention_types for select to authenticated using (true);
create policy "teams read admin" on public.teams for select using (public.is_admin());
create policy "profile teams read admin" on public.profile_teams for select using (public.is_admin());
create policy "resource teams read admin" on public.resource_teams for select using (public.is_admin());

create policy "tickets read assigned or admin" on public.tickets
for select using (
  active = true
  and (
    public.is_admin()
    or id in (select ticket_id from public.current_ticket_ids())
  )
);

create policy "ticket responsables read assigned or admin" on public.ticket_responsables
for select using (
  public.is_admin()
  or ticket_id in (select ticket_id from public.current_ticket_ids())
);

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
