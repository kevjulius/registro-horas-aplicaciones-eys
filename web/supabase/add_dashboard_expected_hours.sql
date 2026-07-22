-- Agrega horas esperadas por mes para el dashboard.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.dashboard_expected_hours (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  expected_hours integer not null check (expected_hours > 0),
  updated_at timestamptz not null default now()
);

insert into public.dashboard_expected_hours (month, expected_hours) values
  ('2026-01', 168),
  ('2026-02', 160),
  ('2026-03', 176),
  ('2026-04', 160),
  ('2026-05', 160),
  ('2026-06', 168),
  ('2026-07', 160),
  ('2026-08', 160),
  ('2026-09', 176),
  ('2026-10', 168),
  ('2026-11', 168),
  ('2026-12', 160),
  ('2027-01', 160),
  ('2027-02', 160),
  ('2027-03', 168),
  ('2027-04', 176),
  ('2027-05', 168),
  ('2027-06', 160),
  ('2027-07', 152),
  ('2027-08', 160),
  ('2027-09', 176),
  ('2027-10', 160),
  ('2027-11', 168),
  ('2027-12', 168)
on conflict (month) do update
set expected_hours = excluded.expected_hours,
    updated_at = now();

alter table public.dashboard_expected_hours enable row level security;

drop policy if exists "dashboard expected hours read admin" on public.dashboard_expected_hours;
create policy "dashboard expected hours read admin"
on public.dashboard_expected_hours
for select using (public.is_admin());
