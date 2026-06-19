import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Profile, Ticket, TicketAttentionType } from "@/lib/types";

const ticketPrefixes: Record<TicketAttentionType, string> = {
  Requerimiento: "REQ",
  Proyecto: "PRO",
  Anteproyecto: "ANT",
  Soporte: "SOP",
  Monitoreo: "MON",
  Incidencia: "INC",
  "Actividades Internas": "ACT"
};

const ticketTypes = Object.keys(ticketPrefixes) as TicketAttentionType[];
const ticketStatuses = ["Cerrado", "Pendiente", "En Proceso", "Cancelado"];
const maxDaysByType: Partial<Record<TicketAttentionType, number>> = {
  Soporte: 15
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const payload = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [payload.message, payload.details, payload.hint, payload.code]
      .filter(Boolean)
      .map(String)
      .join(" | ") || fallback;
  }
  return fallback;
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function requireProfile(request: Request, supabase: ReturnType<typeof adminClient>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sesion no valida.");

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sesion no valida.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single<Profile>();

  if (profileError || !profile?.active || !profile.resource_name) {
    throw new Error("No existe un perfil activo con recurso asignado.");
  }

  return profile;
}

function currentYearSuffix() {
  return String(new Date().getFullYear()).slice(-2);
}

function padCode(prefix: string, yearSuffix: string, value: number) {
  return `${prefix}${yearSuffix}${String(value).padStart(4, "0")}`;
}

function cleanList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function codeNumber(code: string, prefix: string, yearSuffix: string) {
  const match = code.match(new RegExp(`^${prefix}${yearSuffix}(\\d+)$`, "i"));
  return match ? Number(match[1]) : 0;
}

async function nextCode(supabase: ReturnType<typeof adminClient>, type: TicketAttentionType) {
  const prefix = ticketPrefixes[type];
  const yearSuffix = currentYearSuffix();
  const { data, error } = await supabase
    .from("tickets")
    .select("codigo_tck")
    .ilike("codigo_tck", `${prefix}${yearSuffix}%`);
  if (error) throw error;

  const nextNumber = Math.max(0, ...(data ?? []).map((item) => codeNumber(item.codigo_tck, prefix, yearSuffix))) + 1;
  return padCode(prefix, yearSuffix, nextNumber);
}

async function visibleResourcesForProfile(supabase: ReturnType<typeof adminClient>, profile: Profile) {
  const visible = new Set<string>();
  if (profile.resource_name) visible.add(profile.resource_name);

  const { data: memberships, error: membershipsError } = await supabase
    .from("profile_teams")
    .select("team_id")
    .eq("profile_id", profile.id);
  if (membershipsError) throw membershipsError;

  const teamIds = (memberships ?? []).map((item) => item.team_id);
  if (!teamIds.length) return Array.from(visible);

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id")
    .in("id", teamIds)
    .eq("active", true);
  if (teamsError) throw teamsError;

  const activeTeamIds = (teams ?? []).map((item) => item.id);
  if (!activeTeamIds.length) return Array.from(visible);

  const { data: resources, error: resourcesError } = await supabase
    .from("resource_teams")
    .select("resource_name")
    .in("team_id", activeTeamIds);
  if (resourcesError) throw resourcesError;

  (resources ?? []).forEach((item) => visible.add(item.resource_name));
  return Array.from(visible);
}

function validateTicket(ticket: Ticket, responsables: string[], visibleResources: string[]) {
  const required = [
    ticket.fecha_solicitud,
    ticket.sistema,
    ticket.formato,
    ticket.usuario_solicitante,
    ticket.fecha_recepcion,
    ticket.alcance_correo,
    ticket.tipo_atencion,
    ticket.subcategoria_atencion,
    ticket.estado,
    ticket.fecha_termino,
    ticket.en_servicio,
    ticket.aplicativo_se_encuentra
  ];

  if (required.some((value) => !String(value ?? "").trim())) {
    throw new Error("Todos los campos del ticket son obligatorios.");
  }
  if (!ticketTypes.includes(ticket.tipo_atencion)) throw new Error(`Tipo de atencion invalido: ${ticket.tipo_atencion}`);
  if (!ticketStatuses.includes(ticket.estado)) throw new Error(`Estado invalido: ${ticket.estado}`);
  if (ticket.fecha_termino < ticket.fecha_solicitud) throw new Error("La fecha termino no puede ser anterior a la fecha inicio.");
  if (ticket.fecha_termino < new Date().toISOString().slice(0, 10) && ticket.estado !== "Cerrado") {
    throw new Error("Si la fecha termino es anterior a hoy, el estado debe ser Cerrado.");
  }
  if (ticket.fecha_termino >= new Date().toISOString().slice(0, 10) && !["Cerrado", "En Proceso"].includes(ticket.estado)) {
    throw new Error("Si la fecha termino es hoy o futura, el estado debe ser Cerrado o En Proceso.");
  }
  const maxDays = maxDaysByType[ticket.tipo_atencion];
  if (maxDays) {
    const start = new Date(`${ticket.fecha_solicitud}T00:00:00`);
    const end = new Date(`${ticket.fecha_termino}T00:00:00`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days > maxDays) throw new Error(`${ticket.tipo_atencion} permite maximo ${maxDays} dias.`);
  }
  if (!responsables.length) throw new Error("Selecciona al menos un responsable.");
  const invalidResources = responsables.filter((resource) => !visibleResources.includes(resource));
  if (invalidResources.length) throw new Error(`No puedes asignar recursos fuera de tus equipos: ${invalidResources.join(", ")}`);
}

async function readTickets(supabase: ReturnType<typeof adminClient>, profile: Profile): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*, ticket_responsables(resource_name)")
    .eq("active", true)
    .order("codigo_tck");
  if (error) throw error;

  return (data ?? [])
    .filter((row) => (row.ticket_responsables ?? []).some((item: { resource_name: string }) => item.resource_name === profile.resource_name))
    .map((row) => ({
      id: row.id,
      codigo_tck: row.codigo_tck,
      fecha_solicitud: row.fecha_solicitud,
      sistema: row.sistema,
      formato: row.formato,
      usuario_solicitante: row.usuario_solicitante,
      fecha_recepcion: row.fecha_recepcion,
      subject_correo: row.subject_correo,
      alcance_correo: row.alcance_correo,
      tipo_atencion: row.tipo_atencion,
      subcategoria_atencion: row.subcategoria_atencion ?? "",
      estado: row.estado,
      fecha_termino: row.fecha_termino,
      tipo_tck: row.tipo_tck,
      en_servicio: row.en_servicio ?? "No",
      aplicativo_se_encuentra: row.aplicativo_se_encuentra ?? "Si",
      approval_status: row.approval_status ?? "Aprobado",
      rejection_reason: row.rejection_reason ?? "",
      requested_by: row.requested_by ?? null,
      reviewed_by: row.reviewed_by ?? null,
      reviewed_at: row.reviewed_at ?? null,
      responsables: (row.ticket_responsables ?? []).map((item: { resource_name: string }) => item.resource_name),
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const profile = await requireProfile(request, supabase);
    const { ticket } = (await request.json()) as { ticket: Ticket };
    const visibleResources = await visibleResourcesForProfile(supabase, profile);
    const responsables = cleanList(ticket.responsables?.length ? ticket.responsables : [profile.resource_name ?? ""]);
    validateTicket(ticket, responsables, visibleResources);

    const codigoTck = await nextCode(supabase, ticket.tipo_atencion);
    const row = {
      codigo_tck: codigoTck,
      fecha_solicitud: ticket.fecha_solicitud,
      sistema: ticket.sistema.trim(),
      formato: ticket.formato.trim(),
      usuario_solicitante: ticket.usuario_solicitante.trim(),
      fecha_recepcion: ticket.fecha_recepcion,
      subject_correo: (ticket.subject_correo || ticket.alcance_correo).trim(),
      alcance_correo: ticket.alcance_correo.trim(),
      tipo_atencion: ticket.tipo_atencion,
      subcategoria_atencion: ticket.subcategoria_atencion.trim(),
      estado: ticket.estado,
      fecha_termino: ticket.fecha_termino,
      tipo_tck: responsables.length > 1 ? "Grupal" : "Personal",
      en_servicio: ticket.en_servicio,
      aplicativo_se_encuentra: ticket.aplicativo_se_encuentra,
      approval_status: "Aprobado",
      rejection_reason: "",
      requested_by: profile.id,
      active: true,
      updated_at: new Date().toISOString()
    };

    const { data: saved, error } = await supabase.from("tickets").insert(row).select("id").single();
    if (error) throw error;

    const { error: linkError } = await supabase
      .from("ticket_responsables")
      .insert(responsables.map((resourceName) => ({ ticket_id: saved.id, resource_name: resourceName })));
    if (linkError) throw linkError;

    return NextResponse.json({ tickets: await readTickets(supabase, profile) });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "No se pudo solicitar ticket.") },
      { status: 500 }
    );
  }
}
