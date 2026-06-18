"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { AdminBiView } from "@/components/views/AdminBiView";
import { AdminView } from "@/components/views/AdminView";
import { BiView } from "@/components/views/BiView";
import { BulkUploadView } from "@/components/views/BulkUploadView";
import { DashboardView } from "@/components/views/DashboardView";
import { EntriesView } from "@/components/views/EntriesView";
import { RegisterView } from "@/components/views/RegisterView";
import { TicketsView } from "@/components/views/TicketsView";
import {
  getCurrentProfile,
  loadBiEntries,
  loadBiMasters,
  loadEntries,
  loadMasters,
  loadProfiles,
  loadTeams,
  loadTickets,
  loadVisibleResources,
  signIn,
  signOut,
  updatePassword
} from "@/lib/repository";
import type { MasterData, Profile, Team, Ticket, TimeEntry } from "@/lib/types";
import type { BiEntry, BiMasterData } from "@/lib/types";

const menuItems = [
  { key: "tickets", label: "Tickets" },
  { key: "listado", label: "Listado de Atenciones" },
  { key: "registrar", label: "Registrar Atencion" },
  { key: "carga", label: "Carga Masiva - Atencion" },
  { key: "bi", label: "BI" },
  { key: "dashboard", label: "Dashboard" },
  { key: "adminbi", label: "Administracion BI" },
  { key: "admin", label: "Administracion" }
] as const;

type PageKey = (typeof menuItems)[number]["key"];

function isApplicationRole(profile: Profile | null) {
  return Boolean(profile && ["trabajador", "trabajador_aplicaciones", "administracion"].includes(profile.role));
}

function isBiRole(profile: Profile | null) {
  return Boolean(profile && ["trabajador_bi", "adminbi", "administracion"].includes(profile.role));
}

function defaultPageFor(profile: Profile) {
  return isApplicationRole(profile) ? "listado" : "bi";
}

function canViewPage(profile: Profile, key: PageKey) {
  if (["tickets", "listado", "registrar", "carga"].includes(key)) return isApplicationRole(profile);
  if (key === "bi") return isBiRole(profile);
  if (key === "dashboard" || key === "admin") return profile.role === "administracion";
  if (key === "adminbi") return ["adminbi", "administracion"].includes(profile.role);
  return false;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [page, setPage] = useState<PageKey>("listado");
  const [masters, setMasters] = useState<MasterData | null>(null);
  const [biMasters, setBiMasters] = useState<BiMasterData | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [biEntries, setBiEntries] = useState<BiEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [visibleResources, setVisibleResources] = useState<string[]>([]);
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
        setPage(defaultPageFor(currentProfile));
        await refresh(currentProfile);
      })
      .finally(() => setLoading(false));
  }, []);

  async function refresh(currentProfile = profile) {
    if (!currentProfile) return;
    const appAllowed = isApplicationRole(currentProfile);
    const biAllowed = isBiRole(currentProfile);
    const masterData = appAllowed ? await loadMasters() : null;
    const biMasterData = biAllowed ? await loadBiMasters() : null;
    const [entryData, biEntryData, profileData, teamData, ticketData, visibleResourceData] = await Promise.all([
      appAllowed && masterData ? loadEntries(currentProfile) : Promise.resolve([]),
      biAllowed ? loadBiEntries(currentProfile) : Promise.resolve([]),
      currentProfile.role === "administracion" ? loadProfiles() : Promise.resolve([]),
      currentProfile.role === "administracion" ? loadTeams() : Promise.resolve([]),
      appAllowed ? loadTickets(currentProfile) : Promise.resolve([]),
      appAllowed && masterData ? loadVisibleResources(currentProfile, masterData) : Promise.resolve([])
    ]);
    setMasters(masterData);
    setBiMasters(biMasterData);
    setEntries(entryData);
    setBiEntries(biEntryData);
    setProfiles(profileData);
    setTeams(teamData);
    setTickets(ticketData);
    setVisibleResources(visibleResourceData);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoginMessage("");
      await signIn(email, password);
      const currentProfile = await getCurrentProfile();
      if (!currentProfile) throw new Error("No existe un perfil activo para este usuario.");
      setProfile(currentProfile);
      setPage(defaultPageFor(currentProfile));
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
    setBiMasters(null);
    setEntries([]);
    setBiEntries([]);
    setProfiles([]);
    setTeams([]);
    setTickets([]);
    setVisibleResources([]);
    setPassword("");
    setPage("listado");
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

  if (!profile || (isApplicationRole(profile) && !masters) || (isBiRole(profile) && !biMasters)) {
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
        <div className="app-brand">
          <span className="app-mark">E</span>
          <strong>EyS Aplicaciones</strong>
        </div>
        <div className="session">
          <div className="session-avatar">
            {profile.display_name
              .split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2)}
          </div>
          <div>
            <p className="session-name">{profile.display_name}</p>
            <p className="muted">{profile.email}</p>
            <p className="muted">{profile.role}</p>
          </div>
        </div>
        <nav className="menu">
          {menuItems
            .filter((item) => canViewPage(profile, item.key))
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
        <button className="logout-button" type="button" onClick={handleLogout}>
          <LogOut size={16} /> Cerrar sesion
        </button>
      </aside>
      <section className="main">
        <h1>EyS Aplicaciones</h1>
        {page === "registrar" && masters && <RegisterView profile={profile} masters={masters} tickets={tickets} onSaved={() => refresh(profile)} />}
        {page === "carga" && masters && <BulkUploadView profile={profile} masters={masters} tickets={tickets} onSaved={() => refresh(profile)} />}
        {page === "listado" && masters && <EntriesView profile={profile} masters={masters} tickets={tickets} entries={entries} onChanged={() => refresh(profile)} />}
        {page === "tickets" && masters && <TicketsView profile={profile} masters={masters} tickets={tickets} visibleResources={visibleResources} onChanged={() => refresh(profile)} />}
        {page === "bi" && biMasters && <BiView profile={profile} masters={biMasters} entries={biEntries} onChanged={() => refresh(profile)} />}
        {page === "dashboard" &&
          (profile.role === "administracion" ? (
            <DashboardView entries={entries} teams={teams} />
          ) : (
            <div className="notice">Solo administracion puede ver el dashboard.</div>
          ))}
        {page === "admin" &&
          (profile.role === "administracion" && masters ? (
            <AdminView currentUser={profile} masters={masters} profiles={profiles} teams={teams} onChanged={() => refresh(profile)} />
          ) : (
            <div className="notice">Solo administracion puede ingresar aqui.</div>
          ))}
        {page === "adminbi" &&
          (["adminbi", "administracion"].includes(profile.role) && biMasters ? (
            <AdminBiView masters={biMasters} onChanged={() => refresh(profile)} />
          ) : (
            <div className="notice">Solo admin BI puede ingresar aqui.</div>
          ))}
      </section>
    </main>
  );
}
