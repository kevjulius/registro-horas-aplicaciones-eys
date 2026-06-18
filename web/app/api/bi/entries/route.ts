import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BiEntry, Profile } from "@/lib/types";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireBiProfile(request: Request, supabase: ReturnType<typeof adminClient>) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Sesion no valida.");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Sesion no valida.");
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", userData.user.id).single<Profile>();
  if (error || !profile?.active) throw new Error("No existe un perfil activo.");
  if (!["trabajador_bi", "adminbi", "administracion"].includes(profile.role)) throw new Error("No tienes acceso al modulo BI.");
  return profile;
}

function mapEntry(row: Record<string, unknown>): BiEntry {
  return {
    id: String(row.id),
    correlativo: String(row.correlativo ?? ""),
    asignado_a: String(row.asignado_a ?? ""),
    formato: String(row.formato ?? ""),
    solicitado_por: String(row.solicitado_por ?? ""),
    servicio: String(row.servicio ?? ""),
    tipo_atencion: String(row.tipo_atencion ?? ""),
    estado: String(row.estado ?? ""),
    fecha_inicio: String(row.fecha_inicio ?? ""),
    fecha_fin: String(row.fecha_fin ?? ""),
    esfuerzo_horas: Number(row.esfuerzo_horas ?? 0),
    descripcion: String(row.descripcion ?? ""),
    created_by: row.created_by ? String(row.created_by) : null,
    active: Boolean(row.active),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined
  };
}

async function readEntries(supabase: ReturnType<typeof adminClient>, profile: Profile) {
  let query = supabase.from("bi_entries").select("*").eq("active", true).order("created_at", { ascending: false });
  if (profile.role === "trabajador_bi") query = query.eq("asignado_a", profile.resource_name ?? "");
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapEntry);
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

async function nextCode(supabase: ReturnType<typeof adminClient>, attentionName: string) {
  const { data: attention, error: attentionError } = await supabase
    .from("bi_attention_types")
    .select("code")
    .eq("name", attentionName)
    .eq("active", true)
    .single();
  if (attentionError || !attention?.code) throw new Error(`Tipo de atencion BI invalido: ${attentionName}`);
  const code = normalizeCode(attention.code);
  const prefix = `BI-${code}`;
  const { data, error } = await supabase.from("bi_entries").select("correlativo").ilike("correlativo", `${prefix}%`);
  if (error) throw error;
  const nextNumber = Math.max(
    0,
    ...(data ?? []).map((item) => {
      const match = String(item.correlativo ?? "").match(new RegExp(`^${prefix}(\\d+)$`, "i"));
      return match ? Number(match[1]) : 0;
    })
  ) + 1;
  return `${prefix}${String(nextNumber).padStart(7, "0")}`;
}

function validateEntry(entry: BiEntry, profile: Profile) {
  const required = [
    entry.asignado_a,
    entry.formato,
    entry.solicitado_por,
    entry.servicio,
    entry.tipo_atencion,
    entry.estado,
    entry.fecha_inicio,
    entry.fecha_fin,
    entry.esfuerzo_horas,
    entry.descripcion
  ];
  if (required.some((value) => !String(value ?? "").trim())) throw new Error("Todos los campos BI son obligatorios.");
  if (Number(entry.esfuerzo_horas) <= 0 || Number(entry.esfuerzo_horas) > 8) throw new Error("El esfuerzo debe ser mayor a 0 y menor o igual a 8.");
  if (profile.role === "trabajador_bi" && entry.asignado_a !== profile.resource_name) {
    throw new Error("Solo puedes registrar BI para tu propio recurso.");
  }
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    const profile = await requireBiProfile(request, supabase);
    return NextResponse.json({ entries: await readEntries(supabase, profile) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer registros BI." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    const profile = await requireBiProfile(request, supabase);
    const { entry } = (await request.json()) as { entry: BiEntry };
    const cleanEntry = {
      ...entry,
      asignado_a: entry.asignado_a.trim(),
      formato: entry.formato.trim(),
      solicitado_por: entry.solicitado_por.trim(),
      servicio: entry.servicio.trim(),
      tipo_atencion: entry.tipo_atencion.trim(),
      estado: entry.estado.trim(),
      descripcion: entry.descripcion.trim(),
      esfuerzo_horas: Number(entry.esfuerzo_horas)
    };
    validateEntry(cleanEntry, profile);

    const row = {
      correlativo: cleanEntry.correlativo || await nextCode(supabase, cleanEntry.tipo_atencion),
      asignado_a: cleanEntry.asignado_a,
      formato: cleanEntry.formato,
      solicitado_por: cleanEntry.solicitado_por,
      servicio: cleanEntry.servicio,
      tipo_atencion: cleanEntry.tipo_atencion,
      estado: cleanEntry.estado,
      fecha_inicio: cleanEntry.fecha_inicio,
      fecha_fin: cleanEntry.fecha_fin,
      esfuerzo_horas: cleanEntry.esfuerzo_horas,
      descripcion: cleanEntry.descripcion,
      created_by: cleanEntry.created_by ?? profile.id,
      active: cleanEntry.active !== false,
      updated_at: new Date().toISOString()
    };

    const query = cleanEntry.id?.startsWith("new-")
      ? supabase.from("bi_entries").insert(row)
      : supabase.from("bi_entries").upsert({ ...row, id: cleanEntry.id });
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ entries: await readEntries(supabase, profile) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar registro BI." }, { status: 500 });
  }
}
