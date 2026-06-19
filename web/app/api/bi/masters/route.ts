import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { BiMasterData, Profile } from "@/lib/types";

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

function uniqueClean(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

async function readMasters(supabase: ReturnType<typeof adminClient>): Promise<BiMasterData> {
  const [resources, services, attentions, states, formats] = await Promise.all([
    supabase.from("bi_resources").select("name").eq("active", true).order("name"),
    supabase.from("bi_services").select("name").eq("active", true).order("name"),
    supabase.from("bi_attention_types").select("name, code").eq("active", true).order("name"),
    supabase.from("bi_states").select("name").eq("active", true).order("name"),
    supabase.from("bi_formats").select("name").eq("active", true).order("name")
  ]);

  return {
    recursos: (resources.data ?? []).map((item) => item.name),
    servicios: (services.data ?? []).map((item) => item.name),
    atenciones: (attentions.data ?? []).map((item) => ({ name: item.name, code: item.code })),
    estados: (states.data ?? []).map((item) => item.name),
    formatos: (formats.data ?? []).map((item) => item.name)
  };
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireBiProfile(request, supabase);
    return NextResponse.json({ masters: await readMasters(supabase) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer maestras BI." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = adminClient();
    const profile = await requireBiProfile(request, supabase);
    if (!["adminbi", "administracion"].includes(profile.role)) throw new Error("Solo admin BI puede modificar maestras BI.");
    const { masters } = (await request.json()) as { masters: BiMasterData };

    const simpleTables: Array<[keyof Pick<BiMasterData, "recursos" | "servicios" | "estados" | "formatos">, string]> = [
      ["recursos", "bi_resources"],
      ["servicios", "bi_services"],
      ["estados", "bi_states"],
      ["formatos", "bi_formats"]
    ];

    for (const [key, table] of simpleTables) {
      const values = uniqueClean(masters[key] ?? []);
      const valueSet = new Set(values);
      if (values.length) {
        const { error } = await supabase.from(table).upsert(values.map((name) => ({ name, active: true })), { onConflict: "name" });
        if (error) throw error;
      }
      const { data, error } = await supabase.from(table).select("name");
      if (error) throw error;
      const inactive = (data ?? []).map((item) => item.name).filter((name) => !valueSet.has(name));
      if (inactive.length) {
        const { error: updateError } = await supabase.from(table).update({ active: false }).in("name", inactive);
        if (updateError) throw updateError;
      }
    }

    const attentions = masters.atenciones
      .map((item) => ({ name: item.name.trim(), code: item.code.trim().toUpperCase(), active: true }))
      .filter((item) => item.name && item.code);
    const attentionSet = new Set(attentions.map((item) => item.name));
    if (attentions.length) {
      const { error } = await supabase.from("bi_attention_types").upsert(attentions, { onConflict: "name" });
      if (error) throw error;
    }
    const { data: currentAttentions, error: attentionError } = await supabase.from("bi_attention_types").select("name");
    if (attentionError) throw attentionError;
    const inactiveAttentions = (currentAttentions ?? []).map((item) => item.name).filter((name) => !attentionSet.has(name));
    if (inactiveAttentions.length) {
      const { error } = await supabase.from("bi_attention_types").update({ active: false }).in("name", inactiveAttentions);
      if (error) throw error;
    }

    return NextResponse.json({ masters: await readMasters(supabase) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar maestras BI." }, { status: 500 });
  }
}
