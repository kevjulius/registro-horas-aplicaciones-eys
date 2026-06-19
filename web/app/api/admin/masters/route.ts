import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { MasterData, Profile } from "@/lib/types";

type MasterListKey = Exclude<keyof MasterData, "aplicacionesDetalle" | "tiposAtencionDetalle" | "attentionRules">;

const masterTables: Record<MasterListKey, string> = {
  recursos: "resources",
  usuariosReporta: "reporter_users",
  sociedades: "companies",
  aplicaciones: "applications",
  tiposAtencion: "attention_types"
};

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
    throw new Error("Solo administracion puede modificar maestras.");
  }
}

function uniqueClean(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

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

async function readMasters(supabase: ReturnType<typeof adminClient>): Promise<MasterData> {
  const [resources, reporters, companies, apps, attention, attentionRules] = await Promise.all([
    supabase.from("resources").select("name").eq("active", true).order("name"),
    supabase.from("reporter_users").select("name").eq("active", true).order("name"),
    supabase.from("companies").select("name").eq("active", true).order("name"),
    supabase.from("applications").select("*").eq("active", true).order("name"),
    supabase.from("attention_types").select("*").eq("active", true).order("name"),
    supabase.from("attention_type_rules").select("*").eq("active", true).order("tipo_atencion")
  ]);

  return {
    recursos: (resources.data ?? []).map((item) => item.name),
    usuariosReporta: (reporters.data ?? []).map((item) => item.name),
    sociedades: (companies.data ?? []).map((item) => item.name),
    aplicaciones: (apps.data ?? []).map((item) => item.name),
    aplicacionesDetalle: (apps.data ?? []).map((item) => ({
      name: item.name,
      company: item.company ?? "",
      service: item.service ?? "",
      fecha_creacion: item.fecha_creacion ?? ""
    })),
    tiposAtencion: (attention.data ?? []).map((item) => item.name),
    tiposAtencionDetalle: (attention.data ?? []).map((item) => ({
      name: item.name,
      type: item.type ?? String(item.name ?? "").split(" - ")[0]?.trim() ?? "",
      classification: item.classification ?? String(item.name ?? "").split(" - ").slice(1).join(" - ").trim() ?? ""
    })),
    attentionRules: (attentionRules.data ?? []).map((item) => ({
      tipo_atencion: item.tipo_atencion,
      max_dias: item.max_dias ?? null
    }))
  };
}

export async function PUT(request: Request) {
  try {
    const supabase = adminClient();
    await requireAdmin(request, supabase);

    const { masters } = (await request.json()) as { masters: MasterData };

    for (const key of Object.keys(masterTables) as MasterListKey[]) {
      const table = masterTables[key];
      const values = uniqueClean(masters[key] ?? []);
      const valueSet = new Set(values);

      if (values.length) {
        const rows = key === "aplicaciones"
          ? values.map((name) => {
              const detail = masters.aplicacionesDetalle?.find((item) => item.name.trim() === name);
              return {
                name,
                company: detail?.company?.trim() ?? "",
                service: detail?.service?.trim() ?? "",
                ...(detail?.fecha_creacion ? { fecha_creacion: detail.fecha_creacion } : {}),
                active: true
              };
            })
          : values.map((name) => ({ name, active: true }));
        const { error } = await supabase
          .from(table)
          .upsert(rows, { onConflict: "name" });
        if (error) throw error;
      }

      const { data: existing, error: existingError } = await supabase.from(table).select("name");
      if (existingError) throw existingError;

      const toDeactivate = (existing ?? []).map((item) => item.name).filter((name) => !valueSet.has(name));
      for (const name of toDeactivate) {
        const { error } = await supabase.from(table).update({ active: false }).eq("name", name);
        if (error) throw error;
      }
    }

    const ruleRows = (masters.attentionRules ?? [])
      .filter((rule) => rule.tipo_atencion.trim())
      .map((rule) => ({
        tipo_atencion: rule.tipo_atencion.trim(),
        max_dias: rule.max_dias && rule.max_dias > 0 ? rule.max_dias : null,
        active: true
      }));
    if (ruleRows.length) {
      const { error } = await supabase.from("attention_type_rules").upsert(ruleRows, { onConflict: "tipo_atencion" });
      if (error) throw error;
    }

    const activeRuleTypes = new Set(ruleRows.map((rule) => rule.tipo_atencion));
    const { data: existingRules, error: existingRulesError } = await supabase.from("attention_type_rules").select("tipo_atencion");
    if (existingRulesError) throw existingRulesError;
    const rulesToDeactivate = (existingRules ?? []).map((item) => item.tipo_atencion).filter((name) => !activeRuleTypes.has(name));
    for (const tipoAtencion of rulesToDeactivate) {
      const { error } = await supabase.from("attention_type_rules").update({ active: false }).eq("tipo_atencion", tipoAtencion);
      if (error) throw error;
    }

    return NextResponse.json({ masters: await readMasters(supabase) });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "No se pudo guardar maestras.") },
      { status: 500 }
    );
  }
}
