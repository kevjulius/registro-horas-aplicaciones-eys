"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { saveMasters, saveProfiles, saveTeams } from "@/lib/repository";
import type { MasterData, Profile, Team } from "@/lib/types";

type MasterListKey = Exclude<keyof MasterData, "aplicacionesDetalle" | "tiposAtencionDetalle">;

const roleOptions: Profile["role"][] = [
  "trabajador_aplicaciones",
  "trabajador_bi",
  "adminbi",
  "administracion"
];

export function AdminView({
  currentUser,
  masters,
  profiles,
  teams,
  onChanged
}: {
  currentUser: Profile;
  masters: MasterData;
  profiles: Profile[];
  teams: Team[];
  onChanged: () => void;
}) {
  const [localMasters, setLocalMasters] = useState(masters);
  const [localProfiles, setLocalProfiles] = useState(profiles);
  const [localTeams, setLocalTeams] = useState(teams);
  const [adminSection, setAdminSection] = useState<"maestras" | "usuarios" | "equipos">("maestras");
  const [masterKey, setMasterKey] = useState<MasterListKey>("recursos");
  const [newValue, setNewValue] = useState("");
  const [newApplication, setNewApplication] = useState({
    name: "",
    company: "",
    service: "",
    fecha_creacion: ""
  });
  const [adminMessage, setAdminMessage] = useState("");
  const [newUser, setNewUser] = useState<Profile>({
    id: `new-${crypto.randomUUID()}`,
    email: "",
    display_name: "",
    role: "trabajador_aplicaciones",
    resource_name: masters.recursos[0] ?? null,
    active: true
  });

  useEffect(() => {
    setLocalMasters({
      ...masters,
      aplicacionesDetalle: masters.aplicacionesDetalle?.length
        ? masters.aplicacionesDetalle
        : masters.aplicaciones.map((name) => ({ name, company: "", service: "", fecha_creacion: "" }))
    });
  }, [masters]);

  useEffect(() => {
    setLocalProfiles(profiles);
  }, [profiles]);

  useEffect(() => {
    setLocalTeams(teams);
  }, [teams]);

  async function addMaster() {
    if (masterKey === "aplicaciones") {
      if (!newApplication.name.trim()) return;
      const nextDetail = {
        name: newApplication.name.trim(),
        company: newApplication.company.trim(),
        service: newApplication.service.trim(),
        fecha_creacion: newApplication.fecha_creacion
      };
      const nextDetails = [...localMasters.aplicacionesDetalle, nextDetail].sort((a, b) => a.name.localeCompare(b.name));
      const updated = {
        ...localMasters,
        aplicaciones: nextDetails.map((item) => item.name),
        aplicacionesDetalle: nextDetails
      };
      await saveMasterList(updated, "Aplicativo agregado.");
      resetNewApplication();
      return;
    }

    if (!newValue.trim()) return;
    const updated = { ...localMasters, [masterKey]: [...localMasters[masterKey], newValue.trim()].sort() };
    await saveMasterList(updated, "Valor agregado.");
    setNewValue("");
  }

  async function saveMasterList(updated = localMasters, successMessage = "Maestras guardadas.") {
    try {
      const saved = await saveMasters(updated);
      setLocalMasters(saved);
      setAdminMessage(successMessage);
      onChanged();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "No se pudo guardar maestras.");
    }
  }

  async function deleteMasterValue(index: number) {
    const updatedValues = localMasters[masterKey].filter((_, itemIndex) => itemIndex !== index);
    const updated = masterKey === "aplicaciones"
      ? {
          ...localMasters,
          aplicaciones: updatedValues,
          aplicacionesDetalle: localMasters.aplicacionesDetalle.filter((_, itemIndex) => itemIndex !== index)
        }
      : { ...localMasters, [masterKey]: updatedValues };
    await saveMasterList(updated, "Valor eliminado.");
  }

  function updateMasterValue(index: number, value: string) {
    const next = [...localMasters[masterKey]];
    next[index] = value;
    if (masterKey === "aplicaciones") {
      const nextDetails = [...localMasters.aplicacionesDetalle];
      nextDetails[index] = { ...(nextDetails[index] ?? { company: "", service: "", fecha_creacion: "" }), name: value };
      setLocalMasters({ ...localMasters, aplicaciones: next, aplicacionesDetalle: nextDetails });
      return;
    }
    setLocalMasters({ ...localMasters, [masterKey]: next });
  }

  function updateApplicationDetail(index: number, values: Partial<MasterData["aplicacionesDetalle"][number]>) {
    const next = [...localMasters.aplicacionesDetalle];
    next[index] = { ...next[index], ...values };
    setLocalMasters({ ...localMasters, aplicacionesDetalle: next });
  }

  function resetNewApplication() {
    setNewApplication({ name: "", company: "", service: "", fecha_creacion: "" });
  }

  function resetNewUser() {
    setNewUser({
      id: `new-${crypto.randomUUID()}`,
      email: "",
      display_name: "",
      role: "trabajador_aplicaciones",
      resource_name: masters.recursos[0] ?? null,
      active: true
    });
  }

  async function createUser() {
    try {
      if (!newUser.email.trim() || !newUser.display_name.trim()) {
        setAdminMessage("Completa correo y nombre antes de crear el usuario.");
        return;
      }
      const result = await saveProfiles([newUser]);
      if (result.temporaryPasswords.length) {
        setAdminMessage(
          result.temporaryPasswords
            .map((item) => `${item.email}: ${item.password}`)
            .join("\n")
        );
      } else {
        setAdminMessage("Usuario vinculado/actualizado. Si ya existia en Auth, conserva su clave actual.");
      }
      resetNewUser();
      onChanged();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    }
  }

  function patchProfile(index: number, values: Partial<Profile>) {
    setLocalProfiles((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...values };
      return next;
    });
  }

  async function persistProfile(profile: Profile) {
    try {
      if (!profile.email.trim() || !profile.display_name.trim()) {
        setAdminMessage("Completa correo y nombre antes de guardar el usuario.");
        return;
      }
      const result = await saveProfiles([profile]);
      const saved = result.profiles[0];
      if (saved) {
        setLocalProfiles((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      }
      setAdminMessage("Usuario actualizado.");
      onChanged();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "No se pudo actualizar el usuario.");
    }
  }

  function addTeam() {
    setLocalTeams((current) => [
      ...current,
      {
        id: `new-${crypto.randomUUID()}`,
        name: "",
        active: true,
        resources: [],
        profile_ids: []
      }
    ]);
  }

  function patchTeam(index: number, values: Partial<Team>) {
    setLocalTeams((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...values };
      return next;
    });
  }

  function toggleTeamResource(index: number, resource: string) {
    const team = localTeams[index];
    const resources = team.resources.includes(resource)
      ? team.resources.filter((item) => item !== resource)
      : [...team.resources, resource];
    patchTeam(index, { resources });
  }

  function toggleTeamProfile(index: number, profileId: string) {
    const team = localTeams[index];
    const profile_ids = team.profile_ids.includes(profileId)
      ? team.profile_ids.filter((item) => item !== profileId)
      : [...team.profile_ids, profileId];
    patchTeam(index, { profile_ids });
  }

  function removeTeam(index: number) {
    setLocalTeams((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function persistTeams() {
    try {
      const saved = await saveTeams(localTeams);
      setLocalTeams(saved);
      setAdminMessage("Equipos guardados.");
      onChanged();
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "No se pudo guardar equipos.");
    }
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Administracion</h2>
          <p className="muted">Gestiona usuarios y listas maestras sin depender de Excel.</p>
        </div>
        <div className="segmented">
          <button className={adminSection === "maestras" ? "active" : ""} onClick={() => { setAdminMessage(""); setAdminSection("maestras"); }}>Maestras</button>
          <button className={adminSection === "usuarios" ? "active" : ""} onClick={() => { setAdminMessage(""); setAdminSection("usuarios"); }}>Usuarios</button>
          <button className={adminSection === "equipos" ? "active" : ""} onClick={() => { setAdminMessage(""); setAdminSection("equipos"); }}>Equipos</button>
        </div>
      </div>

      {adminSection === "maestras" && (
        <div className="admin-layout">
          <div className="card grid">
            <h3>Selecciona una tabla</h3>
            <div className="master-list">
              {[
                ["recursos", "Recursos"],
                ["usuariosReporta", "Usuarios que reportan"],
                ["aplicaciones", "Aplicativos"],
                ["sociedades", "Sociedades"],
                ["tiposAtencion", "Tipos de atencion"]
              ].map(([key, label]) => (
                <button key={key} className={masterKey === key ? "active" : ""} onClick={() => { setAdminMessage(""); setNewValue(""); resetNewApplication(); setMasterKey(key as MasterListKey); }}>
                  <span>{label}</span>
                  <small>{localMasters[key as MasterListKey].length}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="card grid">
            <div className="section-head compact">
              <h3>{masterLabel(masterKey)}</h3>
              <span className="pill">{localMasters[masterKey].length} valores</span>
            </div>
            {masterKey === "aplicaciones" ? (
              <div className="app-create-panel">
                <label>
                  Aplicativo
                  <input value={newApplication.name} onChange={(e) => setNewApplication({ ...newApplication, name: e.target.value })} placeholder="Nombre del aplicativo" />
                </label>
                <label>
                  Sociedad/empresa
                  <input value={newApplication.company} onChange={(e) => setNewApplication({ ...newApplication, company: e.target.value })} placeholder="Sociedad o empresa" />
                </label>
                <label>
                  Servicio
                  <input value={newApplication.service} onChange={(e) => setNewApplication({ ...newApplication, service: e.target.value })} placeholder="Servicio asociado" />
                </label>
                <label>
                  Fecha creacion
                  <input type="date" value={newApplication.fecha_creacion} onChange={(e) => setNewApplication({ ...newApplication, fecha_creacion: e.target.value })} />
                </label>
                <div className="toolbar app-create-actions">
                  <button type="button" onClick={addMaster}><Plus size={16} /> Agregar aplicativo</button>
                  <button className="secondary" type="button" onClick={resetNewApplication}>Limpiar</button>
                </div>
              </div>
            ) : (
              <div className="toolbar">
                <input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Nuevo valor" />
                <button type="button" onClick={addMaster}><Plus size={16} /> Agregar</button>
              </div>
            )}
            {adminMessage && <pre className="notice">{adminMessage}</pre>}
            {masterKey === "aplicaciones" ? (
              <div className="master-values app-master-values">
                <div className="app-master-header">
                  <span>Aplicativo</span>
                  <span>Sociedad/empresa</span>
                  <span>Servicio</span>
                  <span>Fecha creacion</span>
                  <span></span>
                </div>
                {localMasters.aplicaciones.map((value, index) => {
                  const detail = localMasters.aplicacionesDetalle[index] ?? { name: value, company: "", service: "", fecha_creacion: "" };
                  return (
                    <div className="app-master-row" key={`${value}-${index}`}>
                      <input value={value} onChange={(e) => updateMasterValue(index, e.target.value)} />
                      <input value={detail.company} onChange={(e) => updateApplicationDetail(index, { company: e.target.value })} />
                      <input value={detail.service} onChange={(e) => updateApplicationDetail(index, { service: e.target.value })} />
                      <input type="date" value={detail.fecha_creacion ?? ""} onChange={(e) => updateApplicationDetail(index, { fecha_creacion: e.target.value })} />
                      <button className="secondary icon-button" title="Eliminar valor" onClick={() => deleteMasterValue(index)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="master-values">
                {localMasters[masterKey].map((value, index) => (
                  <div className="master-row" key={`${value}-${index}`}>
                    <input value={value} onChange={(e) => updateMasterValue(index, e.target.value)} />
                    <button className="secondary icon-button" title="Eliminar valor" onClick={() => deleteMasterValue(index)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => saveMasterList()}>Guardar maestras</button>
          </div>
        </div>
      )}

      {adminSection === "usuarios" && (
        <div className="grid">
          <div className="card grid">
            <div className="section-head compact">
              <div>
                <h3>Crear usuario</h3>
                <p className="muted">Crea la cuenta y su perfil sin modificar usuarios existentes.</p>
              </div>
            </div>
            {adminMessage && <pre className="notice">{adminMessage}</pre>}
            <div className="grid grid-2">
              <label>
                Correo
                <input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="correo@empresa.com" />
              </label>
              <label>
                Nombre
                <input value={newUser.display_name} onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })} placeholder="Nombre Apellido" />
              </label>
            </div>
            <div className="grid grid-3">
              <label>
                Rol
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Profile["role"] })}>
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
              <label>
                Recurso
                <select value={newUser.resource_name ?? ""} onChange={(e) => setNewUser({ ...newUser, resource_name: e.target.value })}>
                  {masters.recursos.map((resource) => <option key={resource}>{resource}</option>)}
                </select>
              </label>
              <label>
                Activo
                <select value={newUser.active ? "Si" : "No"} onChange={(e) => setNewUser({ ...newUser, active: e.target.value === "Si" })}>
                  <option>Si</option>
                  <option>No</option>
                </select>
              </label>
            </div>
            <div className="toolbar">
              <button onClick={createUser}><Plus size={16} /> Crear usuario</button>
              <button className="secondary" onClick={resetNewUser}>Limpiar</button>
            </div>
          </div>

          <div className="card grid table-card">
            <div className="section-head compact">
              <h3>Usuarios existentes</h3>
              <span className="pill">{localProfiles.length} usuarios</span>
            </div>
            <table>
              <thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Recurso</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {localProfiles.map((user, index) => (
                  <tr key={user.id}>
                    <td>
                      <input value={user.email} onChange={(event) => patchProfile(index, { email: event.target.value })} />
                      {user.id === currentUser.id ? <span className="self-tag">Tu usuario</span> : null}
                    </td>
                    <td>
                      <input value={user.display_name} onChange={(event) => patchProfile(index, { display_name: event.target.value })} />
                    </td>
                    <td>
                      <select value={user.role} onChange={(event) => patchProfile(index, { role: event.target.value as Profile["role"] })}>
                        {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                        {user.role === "trabajador" && <option value="trabajador">trabajador</option>}
                      </select>
                    </td>
                    <td>
                      <select value={user.resource_name ?? ""} onChange={(event) => patchProfile(index, { resource_name: event.target.value || null })}>
                        <option value="">Sin recurso</option>
                        {masters.recursos.map((resource) => <option key={resource} value={resource}>{resource}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={user.active ? "Si" : "No"} onChange={(event) => patchProfile(index, { active: event.target.value === "Si" })}>
                        <option>Si</option>
                        <option>No</option>
                      </select>
                    </td>
                    <td>
                      <button className="secondary icon-button" type="button" title="Guardar usuario" onClick={() => persistProfile(user)}>
                        <Save size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminSection === "equipos" && (
        <div className="grid">
          <div className="card grid">
            <div className="section-head compact">
              <div>
                <h3>Miniequipos</h3>
                <p className="muted">Los miembros de un equipo pueden ver las atenciones de los recursos asignados a ese equipo.</p>
              </div>
              <button type="button" onClick={addTeam}><Plus size={16} /> Agregar equipo</button>
            </div>
            {adminMessage && <pre className="notice">{adminMessage}</pre>}
            <div className="team-list">
              {localTeams.map((team, index) => (
                <div className="team-card" key={team.id}>
                  <div className="section-head compact">
                    <label>
                      Nombre del equipo
                      <input value={team.name} onChange={(event) => patchTeam(index, { name: event.target.value })} placeholder="BOT" />
                    </label>
                    <button className="secondary icon-button" type="button" title="Eliminar equipo" onClick={() => removeTeam(index)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-2">
                    <label>
                      Recursos visibles
                      <div className="multi-select team-select">
                        {masters.recursos.map((resource) => (
                          <button
                            key={resource}
                            type="button"
                            className={team.resources.includes(resource) ? "active" : ""}
                            onClick={() => toggleTeamResource(index, resource)}
                          >
                            {resource}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label>
                      Miembros
                      <div className="multi-select team-select">
                        {localProfiles.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className={team.profile_ids.includes(user.id) ? "active" : ""}
                            onClick={() => toggleTeamProfile(index, user.id)}
                          >
                            {user.display_name}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>
                </div>
              ))}
              {localTeams.length === 0 && <p className="muted">Aun no hay equipos creados.</p>}
            </div>
            <button type="button" onClick={persistTeams}>Guardar equipos</button>
          </div>
        </div>
      )}
    </section>
  );
}

function masterLabel(key: MasterListKey) {
  return {
    recursos: "Recursos",
    usuariosReporta: "Usuarios que reportan",
    aplicaciones: "Aplicativos",
    sociedades: "Sociedades",
    tiposAtencion: "Tipos de atencion"
  }[key];
}
