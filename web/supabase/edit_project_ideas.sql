-- Ejecutar despues de add_project_ideas.sql para habilitar la edicion completa de ideas.
-- Las correcciones se guardan solo en la idea; no se actualizan los tickets.
begin;

alter table public.project_ideas
  add column if not exists horas_reales numeric(12,2) check (horas_reales >= 0),
  add column if not exists alcance_proyecto text check (alcance_proyecto is null or btrim(alcance_proyecto) <> ''),
  add column if not exists titulo_correo text check (titulo_correo is null or btrim(titulo_correo) <> ''),
  add column if not exists sociedad text check (sociedad is null or btrim(sociedad) <> ''),
  add column if not exists usuario_solicitante text check (usuario_solicitante is null or btrim(usuario_solicitante) <> ''),
  add column if not exists responsables text[] check (responsables is null or (cardinality(responsables) > 0 and array_position(responsables, null) is null));

drop policy if exists "project ideas read manager" on public.project_ideas;
create policy "project ideas read manager" on public.project_ideas for select to authenticated
  using (public.current_profile_role() in ('consulta_proyectos', 'administracion'));
drop policy if exists "project ideas update manager" on public.project_ideas;
create policy "project ideas update manager" on public.project_ideas for update to authenticated
  using (public.current_profile_role() in ('consulta_proyectos', 'administracion'))
  with check (public.current_profile_role() in ('consulta_proyectos', 'administracion'));

revoke update on public.project_ideas from authenticated;
grant update (alcance_proyecto, titulo_correo, sociedad, usuario_solicitante, responsables,
  horas_estimacion, horas_reales, costo_cotizacion, estado_cotizacion, fecha_inicio, fecha_fin, estado_atencion, bloqueantes)
  on public.project_ideas to authenticated;

notify pgrst, 'reload schema';
commit;
