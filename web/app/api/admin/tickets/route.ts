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
const workTypes = ["Personal", "Grupal"];

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

async function requireAdmin(request: Request, supabase: ReturnType<typeof adminClient>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sesion no valida.");

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sesion no valida.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .single<Pick<Profile, "role" | "active">>();

  if (profileError || !profile?.active || profile.role !== "administracion") {
    throw new Error("Solo administracion puede modificar tickets.");
  }
}

function cleanList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function padCode(prefix: string, value: number) {
  return `${prefix}${String(value).padStart(3, "0")}`;
}

function codeNumber(code: string, prefix: string) {
  const match = code.match(new RegExp(`^${prefix}(\\d+)$`, "i"));
  return match ? Number(match[1]) : 0;
}

async function nextCode(supabase: ReturnType<typeof adminClient>, type: TicketAttentionType, usedCodes: Set<string>) {
  const prefix = ticketPrefixes[type];
  const { data, error } = await supabase
    .from("tickets")
    .select("codigo_tck")
    .ilike("codigo_tck", `${prefix}%`);
  if (error) throw error;

  let nextNumber = Math.max(0, ...(data ?? []).map((item) => codeNumber(item.codigo_tck, prefix))) + 1;
  let candidate = padCode(prefix, nextNumber);
  while (usedCodes.has(candidate)) {
    nextNumber += 1;
    candidate = padCode(prefix, nextNumber);
  }
  usedCodes.add(candidate);
  return candidate;
}

function validateTicket(ticket: Ticket) {
  const required = [
    ticket.fecha_solicitud,
    ticket.sistema,
    ticket.formato,
    ticket.usuario_solicitante,
    ticket.fecha_recepcion,
    ticket.subject_correo,
    ticket.alcance_correo,
    ticket.tipo_atencion,
    ticket.estado,
    ticket.fecha_termino,
    ticket.tipo_tck
  ];

  if (required.some((value) => !String(value ?? "").trim())) {
    throw new Error("Todos los campos del ticket son obligatorios.");
  }
  if (!ticketTypes.includes(ticket.tipo_atencion)) throw new Error(`Tipo de atencion invalido: ${ticket.tipo_atencion}`);
  if (!ticketStatuses.includes(ticket.estado)) throw new Error(`Estado invalido: ${ticket.estado}`);
  if (!workTypes.includes(ticket.tipo_tck)) throw new Error(`Tipo de ticket invalido: ${ticket.tipo_tck}`);

  const responsables = cleanList(ticket.responsables ?? []);
  if (ticket.tipo_tck === "Personal" && responsables.length !== 1) {
    throw new Error("Un ticket Personal debe tener exactamente un responsable.");
  }
  if (ticket.tipo_tck === "Grupal" && responsables.length < 2) {
    throw new Error("Un ticket Grupal debe tener dos o mas responsables.");
  }
}

async function readTickets(supabase: ReturnType<typeof adminClient>): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*, ticket_responsables(resource_name)")
    .eq("active", true)
    .order("codigo_tck");
  if (error) throw error;

  return (data ?? []).map((row) => ({
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
    estado: row.estado,
    fecha_termino: row.fecha_termino,
    tipo_tck: row.tipo_tck,
    responsables: (row.ticket_responsables ?? []).map((item: { resource_name: string }) => item.resource_name),
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireAdmin(request, supabase);
    return NextResponse.json({ tickets: await readTickets(supabase) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer tickets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    await requireAdmin(request, supabase);

    const { tickets } = (await request.json()) as { tickets: Ticket[] };
    const cleanTickets = tickets
      .map((ticket) => ({
        ...ticket,
        codigo_tck: ticket.codigo_tck.trim().toUpperCase(),
        sistema: ticket.sistema.trim(),
        formato: ticket.formato.trim(),
        usuario_solicitante: ticket.usuario_solicitante.trim(),
        subject_correo: ticket.subject_correo.trim(),
        alcance_correo: ticket.alcance_correo.trim(),
        responsables: cleanList(ticket.responsables ?? []),
        active: ticket.active !== false
      }))
      .filter((ticket) => ticket.active);

    cleanTickets.forEach(validateTicket);

    const usedCodes = new Set(cleanTickets.map((ticket) => ticket.codigo_tck).filter(Boolean));
    const activeIds = new Set(cleanTickets.filter((ticket) => !ticket.id.startsWith("new-")).map((ticket) => ticket.id));

    for (const ticket of cleanTickets) {
      if (!ticket.codigo_tck || ticket.id.startsWith("new-")) {
        ticket.codigo_tck = await nextCode(supabase, ticket.tipo_atencion, usedCodes);
      }
    }

    const { data: existing, error: existingError } = await supabase.from("tickets").select("id");
    if (existingError) throw existingError;

    for (const ticket of existing ?? []) {
      if (!activeIds.has(ticket.id)) {
        const { error } = await supabase.from("tickets").update({ active: false, updated_at: new Date().toISOString() }).eq("id", ticket.id);
        if (error) throw error;
      }
    }

    for (const ticket of cleanTickets) {
      const row = {
        codigo_tck: ticket.codigo_tck,
        fecha_solicitud: ticket.fecha_solicitud,
        sistema: ticket.sistema,
        formato: ticket.formato,
        usuario_solicitante: ticket.usuario_solicitante,
        fecha_recepcion: ticket.fecha_recepcion,
        subject_correo: ticket.subject_correo,
        alcance_correo: ticket.alcance_correo,
        tipo_atencion: ticket.tipo_atencion,
        estado: ticket.estado,
        fecha_termino: ticket.fecha_termino,
        tipo_tck: ticket.tipo_tck,
        active: true,
        updated_at: new Date().toISOString()
      };

      const query = ticket.id.startsWith("new-")
        ? supabase.from("tickets").insert(row).select("id").single()
        : supabase.from("tickets").update(row).eq("id", ticket.id).select("id").single();
      const { data: saved, error } = await query;
      if (error) throw error;

      const ticketId = saved.id;
      const { error: deleteLinksError } = await supabase.from("ticket_responsables").delete().eq("ticket_id", ticketId);
      if (deleteLinksError) throw deleteLinksError;

      const linkRows = ticket.responsables.map((resourceName) => ({ ticket_id: ticketId, resource_name: resourceName }));
      const { error: insertLinksError } = await supabase.from("ticket_responsables").insert(linkRows);
      if (insertLinksError) throw insertLinksError;
    }

    return NextResponse.json({ tickets: await readTickets(supabase) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar tickets." },
      { status: 500 }
    );
  }
}
