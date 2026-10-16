import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ticket } from "./types";
import { isProjectPlanning } from "./project-ideas";

export async function validatePlanningPermission(supabase: SupabaseClient, ticket: Ticket, actorId: string, isNew: boolean) {
  if (!isProjectPlanning(ticket)) return;
  // Los tickets historicos no tenian ficha de proyecto; sus ediciones conservan el flujo anterior.
  if (!isNew && !ticket.alcance_proyecto?.trim()) {
    const { data, error } = await supabase.from("project_ideas").select("id").eq("ticket_id", ticket.id).maybeSingle();
    if (error) throw error;
    if (!data) return;
  }
  if (!ticket.alcance_proyecto?.trim() || !ticket.subject_correo?.trim()) {
    throw new Error("Alcance Proyecto y Titulo de Correo son obligatorios.");
  }
  if (!isNew) return;
  const { data, error } = await supabase.rpc("profile_can_plan_projects", { p_profile_id: actorId });
  if (error) throw error;
  if (!data) throw new Error("Solo los lideres de equipo pueden crear Anteproyecto - Planificacion.");
}

export async function createPlanningTicket(supabase: SupabaseClient, row: Record<string, unknown>, responsables: string[], creatorId: string) {
  const { data, error } = await supabase.rpc("create_project_planning_ticket", {
    p_ticket: row, p_responsables: responsables, p_creator: creatorId
  });
  if (error) throw error;
  return data as string;
}
