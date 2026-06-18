"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { AdminView } from "@/components/views/AdminView";
import { BulkUploadView } from "@/components/views/BulkUploadView";
import { DashboardView } from "@/components/views/DashboardView";
import { EntriesView } from "@/components/views/EntriesView";
import { RegisterView } from "@/components/views/RegisterView";
import { TicketsView } from "@/components/views/TicketsView";
import {
  getCurrentProfile,
  loadEntries,
  loadMasters,
  loadProfiles,
  loadTeams,
  loadTickets,
  signIn,
  signOut,
  updatePassword
} from "@/lib/repository";
import type { MasterData, Profile, Team, Ticket, TimeEntry } from "@/lib/types";

const menuItems = [
  { key: "registrar", label: "Registrar Atencion" },
  { key: "carga", label: "Carga Masiva - Atencion" },
  { key: "listado", label: "Listado de Atenciones" },
  { key: "tickets", label: "Tickets" },
  { key: "dashboard", label: "Dashboard" },
  { key: "admin", label: "Administracion" }
] as const;

type PageKey = (typeof menuItems)[number]["key"];

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [page, setPage] = useState<PageKey>("registrar");
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loginMessage, setLoginMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (hashParams.has("access_token") && hashParams.get("type") === "recovery") {
      setIsRecovery(true);
      window.history.replaceState(null, "", window.location.pathname);
    }

    getCurrentProfile()
      .then(async (currentProfile) => {
        if (!currentProfile) return;
        setProfile(currentProfile);
        await refresh(currentProfile);
      })
      .finally(() => setLoading(false));
  }, []);

  async function refresh(currentProfile = profile) {
    if (!currentProfile) return;
    const [masterData, entryData, profileData, teamData, ticketData] = await Promise.all([
      loadMasters(),
      loadEntries(currentProfile),
      currentProfile.role === "administracion" ? loadProfiles() : Promise.resolve([]),
      currentProfile.role === "administracion" ? loadTeams() : Promise.resolve([]),
      loadTickets(currentProfile)
    ]);
    setMasters(masterData);
    setEntries(entryData);
    setProfiles(profileData);
    setTeams(teamData);
    setTickets(ticketData);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoginMessage("");
      await signIn(email, password);
      const currentProfile = await getCurrentProfile();
      if (!currentProfile) throw new Error("No existe un perfil activo para este usuario.");
      setProfile(currentProfile);
      await refresh(currentProfile);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "No se pudo ingresar.");
    }
  }

  async function handlePasswordUpdate(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (newPassword.length < 8) {
        setLoginMessage("La nueva clave debe tener al menos 8 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setLoginMessage("Las claves no coinciden.");
        return;
      }
      await updatePassword(newPassword);
      setIsRecovery(false);
      setNewPassword("");
      setConfirmPassword("");
      setLoginMessage("Clave actualizada. Ingresa con tu nueva clave.");
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "No se pudo actualizar la clave.");
    }
  }

  async function handleLogout() {
    await signOut();
    setProfile(null);
    setMasters(null);
    setEntries([]);
    setProfiles([]);
    setTeams([]);
    setTickets([]);
    setPassword("");
    setPage("registrar");
  }

  if (loading) {
    return (
      <main className="login-shell">
        <div className="card login-card">Cargando sesion...</div>
      </main>
    );
  }

  if (isRecovery) {
    return (
      <main className="login-shell">
        <form className="card login-card" onSubmit={handlePasswordUpdate}>
          <h1>EyS Aplicaciones</h1>
          <p className="muted">Define una nueva clave para continuar.</p>
          <label>
            Nueva clave
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <label>
            Confirmar clave
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          {loginMessage && <div className="notice">{loginMessage}</div>}
          <button>Actualizar clave</button>
        </form>
      </main>
    );
  }

  if (!profile || !masters) {
    return (
      <main className="login-shell">
        <form className="card login-card" onSubmit={handleLogin}>
          <h1>EyS Aplicaciones</h1>
          <p className="muted">Ingresa con tu correo para continuar.</p>
          <label>
            Correo
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Clave
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {loginMessage && <div className="notice">{loginMessage}</div>}
          <button>Ingresar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="session">
          <h2>Sesion</h2>
          <p>{profile.display_name}</p>
          <p className="muted">{profile.email}</p>
          <p className="muted">{profile.role}</p>
          <button type="button" onClick={handleLogout}>
            <LogOut size={16} /> Cerrar sesion
          </button>
        </div>
        <nav>
          {menuItems
            .filter((item) => item.key !== "admin" || profile.role === "administracion")
            .filter((item) => item.key !== "dashboard" || profile.role === "administracion")
            .map((item) => (
              <button
                key={item.key}
                className={page === item.key ? "active" : ""}
                type="button"
                onClick={() => setPage(item.key)}
              >
                {item.label}
              </button>
            ))}
        </nav>
      </aside>
      <section className="main">
        <h1>EyS Aplicaciones</h1>
        {page === "registrar" && <RegisterView profile={profile} masters={masters} tickets={tickets} onSaved={() => refresh(profile)} />}
        {page === "carga" && <BulkUploadView profile={profile} masters={masters} tickets={tickets} onSaved={() => refresh(profile)} />}
        {page === "listado" && <EntriesView profile={profile} masters={masters} tickets={tickets} entries={entries} onChanged={() => refresh(profile)} />}
        {page === "tickets" && <TicketsView profile={profile} masters={masters} tickets={tickets} onChanged={() => refresh(profile)} />}
        {page === "dashboard" &&
          (profile.role === "administracion" ? (
            <DashboardView entries={entries} teams={teams} />
          ) : (
            <div className="notice">Solo administracion puede ver el dashboard.</div>
          ))}
        {page === "admin" &&
          (profile.role === "administracion" ? (
            <AdminView currentUser={profile} masters={masters} profiles={profiles} teams={teams} onChanged={() => refresh(profile)} />
          ) : (
            <div className="notice">Solo administracion puede ingresar aqui.</div>
          ))}
      </section>
    </main>
  );
}
