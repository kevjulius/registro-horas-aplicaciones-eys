-- Agrega gestion de tickets y visibilidad por responsable.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.tickets (
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
  approval_status text not null default 'Aprobado' check (approval_status in ('Pendiente', 'Aprobado', 'Rechazado')),
  rejection_reason text not null default '',
  requested_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets add column if not exists approval_status text not null default 'Aprobado';
alter table public.tickets add column if not exists rejection_reason text not null default '';
alter table public.tickets add column if not exists requested_by uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.tickets add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tickets_approval_status_check'
      and conrelid = 'public.tickets'::regclass
  ) then
    alter table public.tickets
      add constraint tickets_approval_status_check
      check (approval_status in ('Pendiente', 'Aprobado', 'Rechazado'));
  end if;
end $$;

create table if not exists public.ticket_responsables (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  resource_name text not null references public.resources(name) on update cascade on delete restrict,
  primary key (ticket_id, resource_name)
);

alter table public.tickets enable row level security;
alter table public.ticket_responsables enable row level security;

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

drop policy if exists "tickets read assigned or admin" on public.tickets;
drop policy if exists "ticket responsables read assigned or admin" on public.ticket_responsables;

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
