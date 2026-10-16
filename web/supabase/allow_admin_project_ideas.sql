-- Ejecutar si Ideas de Proyecto ya esta instalado. Solo amplia la lectura al administrador.
begin;
drop policy if exists "project ideas read manager" on public.project_ideas;
create policy "project ideas read manager" on public.project_ideas for select to authenticated
  using (public.current_profile_role() in ('consulta_proyectos', 'administracion'));
notify pgrst, 'reload schema';
commit;
