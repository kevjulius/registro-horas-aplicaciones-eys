-- Agrega flujo independiente para BI.
-- Ejecutar en Supabase SQL Editor.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('trabajador', 'trabajador_aplicaciones', 'trabajador_bi', 'adminbi', 'administracion'));

create table if not exists public.bi_services (
  name text primary key,
  active boolean not null default true
);

create table if not exists public.bi_attention_types (
  name text primary key,
  code text not null,
  active boolean not null default true
);

create table if not exists public.bi_states (
  name text primary key,
  active boolean not null default true
);

create table if not exists public.bi_formats (
  name text primary key,
  active boolean not null default true
);

create table if not exists public.bi_entries (
  id uuid primary key default gen_random_uuid(),
  correlativo text not null unique,
  asignado_a text not null references public.resources(name) on update cascade on delete restrict,
  formato text not null,
  solicitado_por text not null,
  servicio text not null,
  tipo_atencion text not null,
  estado text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  esfuerzo_horas numeric(5,2) not null check (esfuerzo_horas > 0 and esfuerzo_horas <= 8),
  descripcion text not null,
  created_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.bi_services (name, active) values
  ('Reporte BI', true),
  ('Extracción de datos', true),
  ('Soporte BI', true)
on conflict (name) do update set active = excluded.active;

insert into public.bi_attention_types (name, code, active) values
  ('Soporte', 'SOP', true),
  ('Proyecto', 'PRO', true),
  ('Requerimiento', 'REQ', true),
  ('Monitoreo', 'MON', true)
on conflict (name) do update set code = excluded.code, active = excluded.active;

insert into public.bi_states (name, active) values
  ('Pendiente', true),
  ('En Proceso', true),
  ('Cerrado', true),
  ('Cancelado', true)
on conflict (name) do update set active = excluded.active;

insert into public.bi_formats (name, active) values
  ('BI', true),
  ('Power BI', true),
  ('Excel', true)
on conflict (name) do update set active = excluded.active;

alter table public.bi_services enable row level security;
alter table public.bi_attention_types enable row level security;
alter table public.bi_states enable row level security;
alter table public.bi_formats enable row level security;
alter table public.bi_entries enable row level security;

create or replace function public.is_bi_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('adminbi', 'administracion'), false)
$$;

create or replace function public.current_profile_is_bi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() in ('trabajador_bi', 'adminbi', 'administracion'), false)
$$;

drop policy if exists "bi services read bi" on public.bi_services;
drop policy if exists "bi attentions read bi" on public.bi_attention_types;
drop policy if exists "bi states read bi" on public.bi_states;
drop policy if exists "bi formats read bi" on public.bi_formats;
drop policy if exists "bi entries read own or admin" on public.bi_entries;

create policy "bi services read bi" on public.bi_services for select using (public.current_profile_is_bi());
create policy "bi attentions read bi" on public.bi_attention_types for select using (public.current_profile_is_bi());
create policy "bi states read bi" on public.bi_states for select using (public.current_profile_is_bi());
create policy "bi formats read bi" on public.bi_formats for select using (public.current_profile_is_bi());

create policy "bi entries read own or admin" on public.bi_entries
for select using (
  public.is_bi_admin()
  or asignado_a = public.current_resource_name()
);
