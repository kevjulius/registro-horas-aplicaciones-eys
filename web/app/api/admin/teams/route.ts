import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Profile, Team } from "@/lib/types";

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
    throw new Error("Solo administracion puede modificar equipos.");
  }
}

function cleanList(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

async function readTeams(supabase: ReturnType<typeof adminClient>): Promise<Team[]> {
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, active")
    .eq("active", true)
    .order("name");

  if (teamsError) throw teamsError;
  const teamIds = (teams ?? []).map((team) => team.id);
  if (!teamIds.length) return [];

  const [resourceLinks, profileLinks, applicationLinks] = await Promise.all([
    supabase.from("resource_teams").select("team_id, resource_name").in("team_id", teamIds),
    supabase.from("profile_teams").select("team_id, profile_id").in("team_id", teamIds),
    supabase.from("team_applications").select("team_id, application_name").in("team_id", teamIds)
  ]);

  if (resourceLinks.error) throw resourceLinks.error;
  if (profileLinks.error) throw profileLinks.error;
  if (applicationLinks.error) throw applicationLinks.error;

  return (teams ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    active: team.active,
    resources: (resourceLinks.data ?? [])
      .filter((item) => item.team_id === team.id)
      .map((item) => item.resource_name)
      .sort((a, b) => a.localeCompare(b)),
    applications: (applicationLinks.data ?? [])
      .filter((item) => item.team_id === team.id)
      .map((item) => item.application_name)
      .sort((a, b) => a.localeCompare(b)),
    profile_ids: (profileLinks.data ?? [])
      .filter((item) => item.team_id === team.id)
      .map((item) => item.profile_id)
  }));
}

export async function GET(request: Request) {
  try {
    const supabase = adminClient();
    await requireAdmin(request, supabase);
    return NextResponse.json({ teams: await readTeams(supabase) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo leer equipos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = adminClient();
    await requireAdmin(request, supabase);

    const { teams } = (await request.json()) as { teams: Team[] };
    const cleanTeams = teams
      .map((team) => ({
        ...team,
        name: team.name.trim(),
        resources: cleanList(team.resources ?? []),
        applications: cleanList(team.applications ?? []),
        profile_ids: cleanList(team.profile_ids ?? []),
        active: team.active !== false
      }))
      .filter((team) => team.name);

    const activeNames = new Set(cleanTeams.map((team) => team.name));

    if (cleanTeams.length) {
      const { error } = await supabase
        .from("teams")
        .upsert(cleanTeams.map((team) => ({ name: team.name, active: team.active })), { onConflict: "name" });
      if (error) throw error;
    }

    const { data: existingTeams, error: existingError } = await supabase.from("teams").select("id, name");
    if (existingError) throw existingError;

    const existingByName = new Map((existingTeams ?? []).map((team) => [team.name, team.id]));
    const activeTeamIds = cleanTeams
      .map((team) => existingByName.get(team.name))
      .filter((id): id is string => Boolean(id));

    for (const team of existingTeams ?? []) {
      if (!activeNames.has(team.name)) {
        const { error } = await supabase.from("teams").update({ active: false }).eq("id", team.id);
        if (error) throw error;
      }
    }

    if (activeTeamIds.length) {
      const [deleteResources, deleteProfiles, deleteApplications] = await Promise.all([
        supabase.from("resource_teams").delete().in("team_id", activeTeamIds),
        supabase.from("profile_teams").delete().in("team_id", activeTeamIds),
        supabase.from("team_applications").delete().in("team_id", activeTeamIds)
      ]);
      if (deleteResources.error) throw deleteResources.error;
      if (deleteProfiles.error) throw deleteProfiles.error;
      if (deleteApplications.error) throw deleteApplications.error;
    }

    const resourceRows = cleanTeams.flatMap((team) => {
      const teamId = existingByName.get(team.name);
      if (!teamId) return [];
      return team.resources.map((resourceName) => ({ team_id: teamId, resource_name: resourceName }));
    });
    const profileRows = cleanTeams.flatMap((team) => {
      const teamId = existingByName.get(team.name);
      if (!teamId) return [];
      return team.profile_ids.map((profileId) => ({ team_id: teamId, profile_id: profileId }));
    });
    const applicationRows = cleanTeams.flatMap((team) => {
      const teamId = existingByName.get(team.name);
      if (!teamId) return [];
      return team.applications.map((applicationName) => ({ team_id: teamId, application_name: applicationName }));
    });

    if (resourceRows.length) {
      const { error } = await supabase.from("resource_teams").insert(resourceRows);
      if (error) throw error;
    }

    if (profileRows.length) {
      const { error } = await supabase.from("profile_teams").insert(profileRows);
      if (error) throw error;
    }

    if (applicationRows.length) {
      const { error } = await supabase.from("team_applications").insert(applicationRows);
      if (error) throw error;
    }

    return NextResponse.json({ teams: await readTeams(supabase) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar equipos." },
      { status: 500 }
    );
  }
}
