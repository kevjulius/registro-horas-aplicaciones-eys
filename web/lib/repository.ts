"use client";

import { demoEntries, demoMasterData, demoProfiles, demoTeams } from "./demo-data";
import { hasSupabaseConfig, supabase } from "./supabase";
import type { MasterData, Profile, Team, TimeEntry } from "./types";

const entriesKey = "eys.time_entries";
const profilesKey = "eys.profiles";
const mastersKey = "eys.masters";
const teamsKey = "eys.teams";

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
    const [resources, reporters, companies, apps, attention] = await Promise.all([
      supabase.from("resources").select("name").eq("active", true).order("name"),
      supabase.from("reporter_users").select("name").eq("active", true).order("name"),
      supabase.from("companies").select("name").eq("active", true).order("name"),
      supabase.from("applications").select("*").eq("active", true).order("name"),
      supabase.from("attention_types").select("name").eq("active", true).order("name")
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
      tiposAtencion: (attention.data ?? []).map((item) => item.name)
    };
  }
  return readLocal(mastersKey, demoMasterData);
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
