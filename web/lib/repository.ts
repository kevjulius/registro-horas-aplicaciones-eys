"use client";

import { demoBiEntries, demoBiMasters, demoEntries, demoMasterData, demoProfiles, demoTeams, demoTickets } from "./demo-data";
import { hasSupabaseConfig, supabase } from "./supabase";
import type { BiEntry, BiMasterData, MasterData, Profile, Team, Ticket, TimeEntry } from "./types";

const entriesKey = "eys.time_entries";
const profilesKey = "eys.profiles";
const mastersKey = "eys.masters";
const teamsKey = "eys.teams";
const ticketsKey = "eys.tickets";
const biMastersKey = "eys.bi.masters";
const biEntriesKey = "eys.bi.entries";

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  return JSON.parse(raw) as T;
}

function writeLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function authHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  return headers;
}

export async function signIn(email: string, password: string): Promise<Profile | null> {
  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
    return profile as Profile | null;
  }

  if (!["admin123", "1234"].includes(password)) return null;
  const profiles = readLocal(profilesKey, demoProfiles);
  return profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase() && profile.active) ?? null;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return profile as Profile | null;
  }

  return null;
}

export async function signOut() {
  if (hasSupabaseConfig && supabase) await supabase.auth.signOut();
}

export async function updatePassword(password: string): Promise<boolean> {
  if (!hasSupabaseConfig || !supabase) return false;
  const { error } = await supabase.auth.updateUser({ password });
  return !error;
}

export async function loadMasters(): Promise<MasterData> {
  if (hasSupabaseConfig && supabase) {
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
  const localMasters = readLocal(mastersKey, demoMasterData);
  return {
    ...localMasters,
    tiposAtencionDetalle: localMasters.tiposAtencionDetalle?.length
      ? localMasters.tiposAtencionDetalle
      : localMasters.tiposAtencion.map((name) => {
          const [type, ...classification] = name.split(" - ");
          return { name, type: type.trim(), classification: classification.join(" - ").trim() };
        }),
    attentionRules: localMasters.attentionRules ?? [{ tipo_atencion: "Soporte", max_dias: 15 }]
  };
}

export async function loadBiMasters(): Promise<BiMasterData> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/bi/masters", {
      headers: await authHeaders()
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo leer maestras BI.");
    }
    const payload = (await response.json()) as { masters: BiMasterData };
    return payload.masters;
  }
  return readLocal(biMastersKey, demoBiMasters);
}

export async function saveBiMasters(data: BiMasterData): Promise<BiMasterData> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/bi/masters", {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify({ masters: data })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar maestras BI.");
    }
    const payload = (await response.json()) as { masters: BiMasterData };
    return payload.masters;
  }
  writeLocal(biMastersKey, data);
  return data;
}

export async function saveMasters(data: MasterData): Promise<MasterData> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/admin/masters", {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify({ masters: data })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar maestras.");
    }

    const payload = (await response.json()) as { masters: MasterData };
    return payload.masters;
  }

  writeLocal(mastersKey, data);
  return data;
}

export async function loadEntries(profile: Profile): Promise<TimeEntry[]> {
  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.from("time_entries").select("*").order("fecha_reporte", { ascending: false });
    return (data ?? []) as TimeEntry[];
  }
  const entries = readLocal(entriesKey, demoEntries);
  if (profile.role === "administracion") return entries;
  return entries.filter((entry) => entry.recurso === profile.resource_name);
}

export async function loadBiEntries(profile: Profile): Promise<BiEntry[]> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/bi/entries", {
      headers: await authHeaders()
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { entries: BiEntry[] };
    return payload.entries;
  }
  const entries = readLocal(biEntriesKey, demoBiEntries);
  if (["administracion", "adminbi"].includes(profile.role)) return entries;
  return entries.filter((entry) => entry.asignado_a === profile.resource_name);
}

export async function saveBiEntry(entry: BiEntry): Promise<BiEntry[]> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/bi/entries", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ entry })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar registro BI.");
    }
    const payload = (await response.json()) as { entries: BiEntry[] };
    return payload.entries;
  }
  const entries = readLocal(biEntriesKey, demoBiEntries);
  const nextEntry = { ...entry, correlativo: entry.correlativo || `BI-LOC${String(entries.length + 1).padStart(7, "0")}` };
  const index = entries.findIndex((item) => item.id === entry.id);
  const next = index >= 0
    ? entries.map((item) => (item.id === entry.id ? nextEntry : item))
    : [nextEntry, ...entries];
  writeLocal(biEntriesKey, next);
  return next;
}

export async function deleteBiEntry(id: string): Promise<BiEntry[]> {
  if (hasSupabaseConfig) {
    const response = await fetch(`/api/bi/entries?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: await authHeaders()
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo eliminar registro BI.");
    }
    const payload = (await response.json()) as { entries: BiEntry[] };
    return payload.entries;
  }
  const entries = readLocal(biEntriesKey, demoBiEntries).filter((entry) => entry.id !== id);
  writeLocal(biEntriesKey, entries);
  return entries;
}

export async function saveBiEntries(entries: BiEntry[]): Promise<BiEntry[]> {
  let latest: BiEntry[] = [];
  for (const entry of entries) {
    latest = await saveBiEntry(entry);
  }
  return latest;
}

function mapTicket(row: Record<string, unknown>): Ticket {
  const links = (row.ticket_responsables ?? []) as Array<{ resource_name: string }>;
  return {
    id: String(row.id),
    codigo_tck: String(row.codigo_tck ?? ""),
    fecha_solicitud: String(row.fecha_solicitud ?? ""),
    sistema: String(row.sistema ?? ""),
    formato: String(row.formato ?? ""),
    usuario_solicitante: String(row.usuario_solicitante ?? ""),
    fecha_recepcion: String(row.fecha_recepcion ?? ""),
    subject_correo: String(row.subject_correo ?? ""),
    alcance_correo: String(row.alcance_correo ?? ""),
    tipo_atencion: row.tipo_atencion as Ticket["tipo_atencion"],
    subcategoria_atencion: String(row.subcategoria_atencion ?? ""),
    estado: row.estado as Ticket["estado"],
    fecha_termino: String(row.fecha_termino ?? ""),
    tipo_tck: row.tipo_tck as Ticket["tipo_tck"],
    en_servicio: (row.en_servicio as Ticket["en_servicio"]) ?? "No",
    aplicativo_se_encuentra: (row.aplicativo_se_encuentra as Ticket["aplicativo_se_encuentra"]) ?? "Si",
    approval_status: (row.approval_status as Ticket["approval_status"]) ?? "Aprobado",
    rejection_reason: String(row.rejection_reason ?? ""),
    requested_by: row.requested_by ? String(row.requested_by) : null,
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
    responsables: links.map((item) => item.resource_name).sort((a, b) => a.localeCompare(b)),
    active: Boolean(row.active),
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined
  };
}

export async function loadTickets(profile: Profile): Promise<Ticket[]> {
  if (hasSupabaseConfig && supabase) {
    const rows: Array<Record<string, unknown>> = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data } = await supabase
        .from("tickets")
        .select("*, ticket_responsables(resource_name)")
        .eq("active", true)
        .order("codigo_tck")
        .range(from, from + pageSize - 1);
      rows.push(...((data ?? []) as Array<Record<string, unknown>>));
      if (!data || data.length < pageSize) break;
    }
    const tickets = rows.map(mapTicket);
    if (profile.role === "administracion") return tickets;
    return tickets.filter((ticket) => ticket.responsables.includes(profile.resource_name ?? ""));
  }

  const tickets = readLocal(ticketsKey, demoTickets);
  if (profile.role === "administracion") return tickets;
  return tickets.filter((ticket) => ticket.responsables.includes(profile.resource_name ?? ""));
}

export async function saveTickets(tickets: Ticket[]): Promise<Ticket[]> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/admin/tickets", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ tickets })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar tickets.");
    }

    const payload = (await response.json()) as { tickets: Ticket[] };
    return payload.tickets;
  }

  writeLocal(ticketsKey, tickets);
  return tickets;
}

export async function requestTicket(ticket: Ticket): Promise<{ tickets: Ticket[]; ticketCode?: string }> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/tickets/request", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ ticket })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo solicitar ticket.");
    }

    const payload = (await response.json()) as { tickets: Ticket[]; ticketCode?: string };
    return payload;
  }

  const tickets = readLocal(ticketsKey, demoTickets);
  const requested = {
    ...ticket,
    codigo_tck: ticket.codigo_tck || `TMP${tickets.length + 1}`,
    approval_status: "Aprobado" as const,
    rejection_reason: ""
  };
  const next = [requested, ...tickets];
  writeLocal(ticketsKey, next);
  return { tickets: next, ticketCode: requested.codigo_tck };
}

export async function closeExpiredTickets(): Promise<{ updated: number }> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/admin/tickets", {
      method: "PATCH",
      headers: await authHeaders()
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo cerrar tickets vencidos.");
    }

    return response.json() as Promise<{ updated: number }>;
  }

  const tickets = readLocal(ticketsKey, demoTickets);
  const todayDate = new Date().toISOString().slice(0, 10);
  let updated = 0;
  const next = tickets.map((ticket) => {
    if (ticket.active && ticket.estado === "En Proceso" && ticket.fecha_termino < todayDate) {
      updated += 1;
      return { ...ticket, estado: "Cerrado" as const };
    }
    return ticket;
  });
  writeLocal(ticketsKey, next);
  return { updated };
}

export async function saveEntry(entry: TimeEntry) {
  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.auth.getUser();
    await supabase.from("time_entries").upsert({
      ...entry,
      created_by: entry.created_by ?? data.user?.id ?? null,
      modificado: new Date().toISOString()
    });
    return;
  }
  const entries = readLocal(entriesKey, demoEntries);
  const index = entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) entries[index] = entry;
  else entries.unshift(entry);
  writeLocal(entriesKey, entries);
}

export async function saveEntries(newEntries: TimeEntry[]) {
  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    await supabase.from("time_entries").insert(newEntries.map((entry) => ({
      ...entry,
      created_by: entry.created_by ?? userId,
      modificado: new Date().toISOString()
    })));
    return;
  }
  const entries = readLocal(entriesKey, demoEntries);
  writeLocal(entriesKey, [...newEntries, ...entries]);
}

export async function deleteEntry(id: string) {
  if (hasSupabaseConfig && supabase) {
    await supabase.from("time_entries").delete().eq("id", id);
    return;
  }
  const entries = readLocal(entriesKey, demoEntries).filter((entry) => entry.id !== id);
  writeLocal(entriesKey, entries);
}

export async function loadProfiles(): Promise<Profile[]> {
  if (hasSupabaseConfig && supabase) {
    const { data } = await supabase.from("profiles").select("*").order("display_name");
    return (data ?? []) as Profile[];
  }
  return readLocal(profilesKey, demoProfiles);
}

export type SaveProfilesResult = {
  profiles: Profile[];
  temporaryPasswords: Array<{ email: string; password: string }>;
};

export async function saveProfiles(profiles: Profile[]): Promise<SaveProfilesResult> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/admin/profiles", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ profiles })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar usuarios.");
    }

    return response.json() as Promise<SaveProfilesResult>;
  }

  writeLocal(profilesKey, profiles);
  return { profiles, temporaryPasswords: [] };
}

export async function loadTeams(): Promise<Team[]> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/admin/teams", {
      headers: await authHeaders()
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as { teams: Team[] };
    return payload.teams;
  }

  return readLocal(teamsKey, demoTeams);
}

export async function loadVisibleResources(profile: Profile, masters: MasterData): Promise<string[]> {
  if (profile.role === "administracion") return masters.recursos;

  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.rpc("current_visible_resource_names");
    if (!error && data) {
      return Array.from(
        new Set(
          (data as Array<{ resource_name: string }>)
            .map((item) => item.resource_name)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
    }
    return profile.resource_name ? [profile.resource_name] : [];
  }

  const teams = readLocal(teamsKey, demoTeams);
  const visible = new Set<string>();
  if (profile.resource_name) visible.add(profile.resource_name);
  teams
    .filter((team) => team.active && team.profile_ids.includes(profile.id))
    .forEach((team) => team.resources.forEach((resource) => visible.add(resource)));
  return Array.from(visible).sort((a, b) => a.localeCompare(b));
}

export async function loadVisibleApplications(profile: Profile, masters: MasterData): Promise<string[]> {
  if (profile.role === "administracion") return masters.aplicaciones;

  if (hasSupabaseConfig && supabase) {
    const { data, error } = await supabase.rpc("current_visible_application_names");
    if (!error && data) {
      return Array.from(
        new Set(
          (data as Array<{ application_name: string }>)
            .map((item) => item.application_name)
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));
    }
    if (!error) return [];
  }

  const teams = readLocal(teamsKey, demoTeams);
  const visible = new Set<string>();
  teams
    .filter((team) => team.active && team.profile_ids.includes(profile.id))
    .forEach((team) => (team.applications ?? []).forEach((application) => visible.add(application)));
  return Array.from(visible).sort((a, b) => a.localeCompare(b));
}

export async function saveTeams(teams: Team[]): Promise<Team[]> {
  if (hasSupabaseConfig) {
    const response = await fetch("/api/admin/teams", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ teams })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error ?? "No se pudo guardar equipos.");
    }

    const payload = (await response.json()) as { teams: Team[] };
    return payload.teams;
  }

  writeLocal(teamsKey, teams);
  return teams;
}
