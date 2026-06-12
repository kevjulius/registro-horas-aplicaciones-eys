import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";

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
    throw new Error("Solo administracion puede modificar usuarios.");
  }
}

function temporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const token = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
  return `EYS-${token}-2026!`;
}

async function findUserIdByEmail(supabase: ReturnType<typeof adminClient>, email: string) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

export async function POST(request: Request) {
  try {
    const { profiles } = (await request.json()) as { profiles: Profile[] };
    const supabase = adminClient();
    await requireAdmin(request, supabase);
    const savedProfiles: Profile[] = [];
    const temporaryPasswords: Array<{ email: string; password: string }> = [];

    for (const profile of profiles) {
      const cleanProfile = {
        ...profile,
        email: profile.email.trim().toLowerCase(),
        display_name: profile.display_name.trim(),
        resource_name: profile.resource_name || null
      };

      if (!cleanProfile.email || !cleanProfile.display_name || !cleanProfile.role) continue;

      let userId = cleanProfile.id;

      if (!userId || userId.startsWith("new-")) {
        const password = temporaryPassword();
        const { data, error } = await supabase.auth.admin.createUser({
          email: cleanProfile.email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name: cleanProfile.display_name
          }
        });

        if (error) {
          const existingUserId = await findUserIdByEmail(supabase, cleanProfile.email);
          if (!existingUserId) throw error;
          userId = existingUserId;
        } else {
          if (!data.user) throw new Error(`No se pudo crear el usuario ${cleanProfile.email}.`);
          userId = data.user.id;
          temporaryPasswords.push({ email: cleanProfile.email, password });
        }
      } else {
        const { error } = await supabase.auth.admin.updateUserById(userId, {
          email: cleanProfile.email,
          user_metadata: {
            display_name: cleanProfile.display_name
          }
        });
        if (error) throw error;
      }

      const nextProfile = {
        id: userId,
        email: cleanProfile.email,
        display_name: cleanProfile.display_name,
        role: cleanProfile.role,
        resource_name: cleanProfile.resource_name,
        active: cleanProfile.active
      };

      const { data, error } = await supabase.from("profiles").upsert(nextProfile).select("*").single();
      if (error) throw error;
      savedProfiles.push(data as Profile);
    }

    return NextResponse.json({ profiles: savedProfiles, temporaryPasswords });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar usuarios." },
      { status: 500 }
    );
  }
}
