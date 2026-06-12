-- Refuerza maximo 8 horas por registro en base de datos.
-- Ejecutar en Supabase SQL Editor si quieres que la regla aplique tambien fuera de la app.

alter table public.time_entries
drop constraint if exists time_entries_horas_invertidas_check;

alter table public.time_entries
add constraint time_entries_horas_invertidas_check
check (horas_invertidas > 0 and horas_invertidas <= 8);
