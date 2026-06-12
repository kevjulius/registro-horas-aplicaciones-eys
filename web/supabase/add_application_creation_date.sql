-- Agrega fecha de creacion manual para aplicativos.
-- Ejecutar en Supabase SQL Editor antes de usar la nueva version publicada.

alter table public.applications
add column if not exists fecha_creacion date;
