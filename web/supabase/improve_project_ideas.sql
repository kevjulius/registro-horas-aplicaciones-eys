-- Ejecutar despues de add_project_ideas.sql y edit_project_ideas.sql.
-- No modifica los tickets ni reinicia correlativos.
begin;

alter table public.project_ideas
  add column if not exists fecha_envio_estimacion date,
  add column if not exists fecha_envio_cotizacion date,
  add column if not exists proveedor_externo boolean not null default false,
  add column if not exists prioridad boolean not null default false;

alter table public.project_ideas drop constraint if exists project_ideas_estado_cotizacion_check;
alter table public.project_ideas add constraint project_ideas_estado_cotizacion_check
  check (estado_cotizacion in ('Por entregar', 'Por aprobar', 'Aprobado', 'Observada'));

-- La pertenencia se determina por el creador del ticket, no por sus responsables editables.
create or replace function public.current_leader_can_read_project_idea(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profile_teams leader_team
    join public.teams team on team.id = leader_team.team_id and team.active
    join public.profiles leader on leader.id = leader_team.profile_id and leader.active
    join public.profile_teams creator_team on creator_team.team_id = leader_team.team_id
    join public.tickets ticket on ticket.requested_by = creator_team.profile_id
    where leader_team.profile_id = auth.uid() and leader_team.is_leader
      and leader.role in ('trabajador', 'trabajador_aplicaciones', 'administracion')
      and ticket.id = p_ticket_id
  )
$$;
revoke all on function public.current_leader_can_read_project_idea(uuid) from public, anon;
grant execute on function public.current_leader_can_read_project_idea(uuid) to authenticated;

drop policy if exists "project ideas read team leader" on public.project_ideas;
create policy "project ideas read team leader" on public.project_ideas for select to authenticated
  using (public.current_leader_can_read_project_idea(ticket_id));

grant update (fecha_envio_estimacion, fecha_envio_cotizacion, proveedor_externo, prioridad)
  on public.project_ideas to authenticated;

notify pgrst, 'reload schema';
commit;
