import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cleanProjectIdeaUpdate } from "@/lib/project-ideas";
import type { ProjectIdea } from "@/lib/types";

export const dynamic = "force-dynamic";

class AccessError extends Error {}

async function managerClients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) throw new Error("Falta configurar Supabase.");
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new AccessError("Sesion no valida.");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, serviceKey, options);
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) throw new AccessError("Sesion no valida.");
  const { data: profile, error } = await admin.from("profiles").select("role, active").eq("id", auth.user.id).single();
  if (error || !profile?.active || !["consulta_proyectos", "administracion"].includes(profile.role)) {
    throw new AccessError("Solo administracion y consulta_proyectos pueden ingresar a Ideas de Proyecto.");
  }
  const manager = createClient(url, anonKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  return { admin, manager };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message
    : error && typeof error === "object" && "message" in error ? String(error.message) : "No se pudo procesar la idea de proyecto.";
  return NextResponse.json({ error: message }, { status: error instanceof AccessError ? 403 : 400 });
}

export async function GET(request: Request) {
  try {
    const { admin } = await managerClients(request);
    const ideas: ProjectIdea[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await admin.from("project_ideas")
        .select("*, tickets!inner(codigo_tck, alcance_proyecto, subject_correo, formato, usuario_solicitante, ticket_responsables(resource_name))")
        .order("idea_number", { ascending: false }).range(offset, offset + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        const ticket = row.tickets as unknown as {
          codigo_tck: string; alcance_proyecto: string; subject_correo: string; formato: string;
          usuario_solicitante: string; ticket_responsables: { resource_name: string }[];
        };
        const { tickets: _ticket, ...idea } = row;
        ideas.push({
          ...idea, ticket_code: ticket.codigo_tck, alcance_proyecto: idea.alcance_proyecto ?? ticket.alcance_proyecto,
          titulo_correo: idea.titulo_correo ?? ticket.subject_correo, sociedad: idea.sociedad ?? ticket.formato,
          usuario_solicitante: idea.usuario_solicitante ?? ticket.usuario_solicitante,
          responsables: idea.responsables ?? ticket.ticket_responsables.map((link) => link.resource_name).sort(),
          horas_estimacion: idea.horas_estimacion === null ? null : Number(idea.horas_estimacion),
          horas_reales: idea.horas_reales == null ? null : Number(idea.horas_reales),
          costo_cotizacion: idea.costo_cotizacion === null ? null : Number(idea.costo_cotizacion)
        } as ProjectIdea);
      }
      if (!data || data.length < pageSize) break;
    }
    async function catalog(table: "companies" | "reporter_users" | "resources") {
      const names: string[] = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await admin.from(table).select("name").eq("active", true)
          .order("name").range(offset, offset + pageSize - 1);
        if (error) throw error;
        names.push(...(data ?? []).map((row) => row.name));
        if (!data || data.length < pageSize) break;
      }
      return names;
    }
    const [sociedades, solicitantes, responsables] = await Promise.all([
      catalog("companies"), catalog("reporter_users"), catalog("resources")
    ]);
    return NextResponse.json({ ideas, catalogs: { sociedades, solicitantes, responsables } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const { manager } = await managerClients(request);
    const input = await request.json();
    if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) throw new Error("Idea no valida.");
    const values = cleanProjectIdeaUpdate(input);
    const { data, error } = await manager.from("project_ideas").update(values).eq("id", input.id).select("id").single();
    if (error) {
      if (error.code === "PGRST204" || error.code === "42703") {
        throw new Error("Ejecuta edit_project_ideas.sql en Supabase para habilitar la edicion completa de ideas.");
      }
      throw error;
    }
    if (!data) throw new Error("La idea ya no existe o no tienes permiso para editarla.");
    return NextResponse.json({ saved: true });
  } catch (error) { return failure(error); }
}
