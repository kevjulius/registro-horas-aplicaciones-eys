import { randomBytes } from "node:crypto";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Indica el correo exacto: node scripts/reset-user-password.mjs correo@empresa.com");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Falta configurar Supabase.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let user;
for (let page = 1; ; page += 1) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  user = data.users.find((item) => item.email?.toLowerCase() === email);
  if (user || data.users.length < 1000) break;
}
if (!user) throw new Error(`No existe una cuenta con el correo ${email}.`);
const password = `Eys9!${randomBytes(18).toString("base64url")}`;
const { data, error } = await client.auth.admin.updateUserById(user.id, { password });
if (error) throw error;
if (data.user?.id !== user.id) throw new Error("No se pudo confirmar la actualizacion del usuario.");
console.log(JSON.stringify({ email: user.email, password, updated: true }));
