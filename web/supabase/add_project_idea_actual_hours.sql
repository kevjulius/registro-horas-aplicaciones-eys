-- Agrega Cantidad HH reales a Ideas de Proyecto. Ejecutar en Supabase SQL Editor.
begin;
alter table public.project_ideas
  add column if not exists horas_reales numeric(12,2) check (horas_reales >= 0);
grant update (horas_reales) on public.project_ideas to authenticated;
notify pgrst, 'reload schema';
commit;
