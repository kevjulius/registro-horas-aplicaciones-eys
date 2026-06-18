"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LogOut, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import {
  clearHourValidation,
  emptyEntry,
  estados,
  hourValidationMessage,
  MultiSelectField,
  SelectField,
  showHourValidation,
  siNo,
  TicketCodeField,
  ticketMatchesEntry,
  today
} from "@/components/app-shared";
import { TicketsView } from "@/components/views/TicketsView";
import { bulkHeaders, parseBulkText } from "@/lib/bulk";
import {
  deleteEntry,
  getCurrentProfile,
  loadEntries,
  loadMasters,
  loadProfiles,
  loadTeams,
  loadTickets,
  saveEntries,
  saveEntry,
  saveMasters,
  saveProfiles,
  saveTeams,
  signIn,
  signOut,
  updatePassword
} from "@/lib/repository";
import type { MasterData, Profile, Team, Ticket, TimeEntry } from "@/lib/types";
const menuItems = [
  { key: "registrar", label: "Registrar Atención" },
  { key: "carga", label: "Carga Masiva - Atención" },
  { key: "listado", label: "Listado de Atenciones" },
  { key: "tickets", label: "Tickets" },
  { key: "dashboard", label: "Dashboard" },
  { key: "admin", label: "Administración" }
] as const;

type PageKey = (typeof menuItems)[number]["key"];
type MasterListKey = Exclude<keyof MasterData, "aplicacionesDetalle">;

function xmlCell(value: string | number) {
  const escaped = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<Cell><Data ss:Type="String">${escaped}</Data></Cell>`;
}

function xmlColumns(dateColumns: string[] = []) {
  return bulkHeaders
    .map((header) => dateColumns.includes(header) ? `<Column ss:StyleID="dateIso"/>` : "<Column/>")
    .join("");
}

function worksheetOptions(hidden = false) {
  return hidden
    ? `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Visible>SheetHidden</Visible></WorksheetOptions>`
    : "";
}

function xmlSheet(
  name: string,
  rows: Array<Array<string | number>>,
  validations = "",
  options: { hidden?: boolean; dateColumns?: string[] } = {}
) {
  const safeName = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  const columns = options.dateColumns?.length ? xmlColumns(options.dateColumns) : "";
  return `<Worksheet ss:Name="${safeName}"><Table>${columns}${rows
    .map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`)
    .join("")}</Table>${validations}${worksheetOptions(Boolean(options.hidden))}</Worksheet>`;
}

function namedRange(name: string, sheet: string, count: number) {
  const safeCount = Math.max(count + 1, 2);
  return `<NamedRange ss:Name="${name}" ss:RefersTo="='${sheet}'!R2C1:R${safeCount}C1"/>`;
}

function listValidation(columnName: string, namedList: string, rows = 500) {
  const column = bulkHeaders.indexOf(columnName) + 1;
  if (!column) return "";

  return `<DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
    <Range>R2C${column}:R${rows}C${column}</Range>
    <Type>List</Type>
    <Value>=${namedList}</Value>
  </DataValidation>`;
}

function downloadBulkTemplate(masters: MasterData, profile: Profile) {
  const validations = [
    listValidation("usuario_reporta", "lista_usuarios_reporta"),
    listValidation("recurso", "lista_recursos"),
    listValidation("aplicativo", "lista_aplicativos"),
    listValidation("sociedad", "lista_sociedades"),
    listValidation("tipo_atencion", "lista_tipos_atencion"),
    listValidation("estado_tck", "lista_estados"),
    listValidation("en_servicio", "lista_si_no"),
    listValidation("aplicativo_se_encuentra", "lista_si_no")
  ].join("");

  const blankRows = Array.from({ length: 499 }, () => bulkHeaders.map(() => ""));

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="dateIso">
      <NumberFormat ss:Format="yyyy-mm-dd"/>
    </Style>
  </Styles>
  <Names>
    ${namedRange("lista_recursos", "Recursos", masters.recursos.length)}
    ${namedRange("lista_usuarios_reporta", "Usuarios reporta", masters.usuariosReporta.length)}
    ${namedRange("lista_aplicativos", "Aplicativos", masters.aplicaciones.length)}
    ${namedRange("lista_sociedades", "Sociedades", masters.sociedades.length)}
    ${namedRange("lista_tipos_atencion", "Tipos atencion", masters.tiposAtencion.length)}
    ${namedRange("lista_estados", "Estados", estados.length)}
    ${namedRange("lista_si_no", "Si No", siNo.length)}
  </Names>
  ${xmlSheet("Plantilla", [bulkHeaders, ...blankRows], validations, { dateColumns: ["fecha_reporte", "fecha_inicio", "fecha_fin"] })}
  ${xmlSheet("Recursos", [["recurso"], ...masters.recursos.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Usuarios reporta", [["usuario_reporta"], ...masters.usuariosReporta.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Aplicativos", [["aplicativo"], ...masters.aplicaciones.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Sociedades", [["sociedad"], ...masters.sociedades.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Tipos atencion", [["tipo_atencion"], ...masters.tiposAtencion.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Estados", [["estado_tck"], ...estados.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Si No", [["valor"], ...siNo.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Notas", [
    ["Campo", "Nota"],
    ["sociedad", "El desplegable permite elegir una sociedad. Para varias sociedades, escribirlas separadas con | usando valores exactos de la hoja Sociedades."],
    ["fechas", "Usar formato YYYY-MM-DD."],
    ["horas_invertidas", "Usar numero mayor a cero y maximo 8."]
  ])}
</Workbook>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_carga_masiva_horas.xls";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const entryExportHeaders: Array<{ key: keyof TimeEntry; label: string }> = [
  { key: "fecha_reporte", label: "Fecha reporte" },
  { key: "codigo_tck", label: "Codigo TCK" },
  { key: "usuario_reporta", label: "Usuario que reporta" },
  { key: "recurso", label: "Recurso" },
  { key: "aplicativo", label: "Aplicativo" },
  { key: "sociedad", label: "Sociedad" },
  { key: "tipo_atencion", label: "Tipo de atencion" },
  { key: "horas_invertidas", label: "Horas invertidas" },
  { key: "fecha_inicio", label: "Fecha inicio" },
  { key: "fecha_fin", label: "Fecha fin" },
  { key: "estado_tck", label: "Estado TCK" },
  { key: "en_servicio", label: "Servicio empresa" },
  { key: "aplicativo_se_encuentra", label: "Aplicativo operativo" },
  { key: "descripcion", label: "Descripcion" }
];

function csvValue(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return text.replace(/[\r\n]+/g, " ").replace(/;/g, ",").trim();
}

function exportEntriesCsv(entries: TimeEntry[]) {
  const rows = [
    entryExportHeaders.map((header) => csvValue(header.label)).join(";"),
    ...entries.map((entry) => entryExportHeaders.map((header) => csvValue(entry[header.key])).join(";"))
  ];
  const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `registros_horas_${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  async function refresh(currentProfile = profile) {
    const nextMasters = await loadMasters();
    setMasters(nextMasters);
    if (currentProfile) {
      setEntries(await loadEntries(currentProfile));
      setTickets(await loadTickets(currentProfile));
    }
    setProfiles(await loadProfiles());
    setTeams(await loadTeams());
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      let restoredProfile: Profile | null = null;

      if (typeof window !== "undefined") {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        setIsRecovery(hash.get("type") === "recovery" || hash.has("access_token"));
      }

      restoredProfile = await getCurrentProfile();
      if (!active) return;

      if (restoredProfile) setProfile(restoredProfile);
      await refresh(restoredProfile);
      if (active) setCheckingSession(false);
    }

    boot();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const user = await signIn(email, password);
    if (!user) {
      setMessage("Correo o clave incorrectos.");
      return;
    }
    setProfile(user);
    setMessage("");
    await refresh(user);
  }

  async function handlePasswordReset(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setMessage("La clave debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Las claves no coinciden.");
      return;
    }
    const ok = await updatePassword(newPassword);
    if (!ok) {
      setMessage("No se pudo actualizar la clave. Vuelve a abrir el link de recuperacion.");
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    setIsRecovery(false);
    setMessage("Clave actualizada. Ya puedes ingresar con tu nueva clave.");
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
    await signOut();
  }

  if (checkingSession) {
    return <main className="login"><div className="login-card">Cargando sesion...</div></main>;
  }

  if (!profile) {
    if (isRecovery) {
      return (
        <main className="login">
          <form className="login-card grid" onSubmit={handlePasswordReset}>
            <div>
              <h1>Nueva clave</h1>
              <p className="muted">Crea una clave nueva para tu cuenta.</p>
            </div>
            <label>
              Nueva clave
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus />
            </label>
            <label>
              Confirmar clave
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
            {message && <div className="notice">{message}</div>}
            <button>Guardar nueva clave</button>
          </form>
        </main>
      );
    }

    return (
      <main className="login">
        <form className="login-card grid" onSubmit={handleLogin}>
          <div>
            <h1>EyS Aplicaciones</h1>
            <p className="muted">Ingresa con tu correo para continuar.</p>
          </div>
          <label>
            Correo
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@empresa.com" />
          </label>
          <label>
            Clave
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {message && <div className="notice">{message}</div>}
          <button>Ingresar</button>
        </form>
      </main>
    );
  }

  if (!masters) return <main className="main">Cargando...</main>;

  return (
    <main className="app">
      <aside className="sidebar">
        <h3>Sesion</h3>
        <p>{profile.display_name}</p>
        <p className="muted">{profile.email}</p>
        <p className="muted">{profile.role}</p>
        <button
          onClick={async () => {
            await signOut();
            setProfile(null);
          }}
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
        <nav className="menu">
          {menuItems.map((item) => (
            <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => setPage(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="main">
        <h1>EyS Aplicaciones</h1>
        {page === "registrar" && <Register profile={profile} masters={masters} tickets={tickets} onSaved={() => refresh(profile)} />}
        {page === "carga" && <Bulk profile={profile} masters={masters} tickets={tickets} onSaved={() => refresh(profile)} />}
        {page === "listado" && <Entries profile={profile} masters={masters} tickets={tickets} entries={entries} onChanged={() => refresh(profile)} />}
        {page === "tickets" && <TicketsView profile={profile} masters={masters} tickets={tickets} onChanged={() => refresh(profile)} />}
        {page === "dashboard" &&
          (profile.role === "administracion" ? (
            <Dashboard entries={entries} teams={teams} />
          ) : (
            <div className="notice">Solo administracion puede ver el dashboard.</div>
          ))}
        {page === "admin" &&
          (profile.role === "administracion" ? (
            <Admin currentUser={profile} masters={masters} profiles={profiles} teams={teams} onChanged={() => refresh(profile)} />
          ) : (
            <div className="notice">Solo administracion puede ingresar aqui.</div>
          ))}
      </section>
    </main>
  );
}

function Register({ profile, masters, tickets, onSaved }: { profile: Profile; masters: MasterData; tickets: Ticket[]; onSaved: () => void }) {
  const [entry, setEntry] = useState<TimeEntry>(() => emptyEntry(profile));
  const [saveMessage, setSaveMessage] = useState("");

  function patch(values: Partial<TimeEntry>) {
    setEntry((current) => ({ ...current, ...values }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!entry.codigo_tck || !entry.sociedad || !entry.horas_invertidas) {
      setSaveMessage("Completa TCK, sociedad y horas antes de guardar.");
      return;
    }
    if (!tickets.some((ticket) => ticketMatchesEntry(ticket, entry, profile))) {
      setSaveMessage("Selecciona un ticket existente asignado a tu usuario.");
      return;
    }
    if (entry.horas_invertidas <= 0 || entry.horas_invertidas > 8) {
      setSaveMessage(hourValidationMessage);
      return;
    }
    await saveEntry({ ...entry, codigo_tck: entry.codigo_tck.toUpperCase(), modificado: new Date().toISOString() });
    setEntry(emptyEntry(profile));
    setSaveMessage("Registro guardado con exito.");
    onSaved();
  }

  return (
    <form className="card grid register-card" onSubmit={submit}>
      <div className="section-head compact register-title">
        <div>
          <h2>Nuevo registro</h2>
          <p className="muted">Completa los datos de la atencion antes de guardar.</p>
        </div>
      </div>
      <div className="form-band">
        <h3>Datos generales</h3>
        <div className="grid grid-3">
        <TicketCodeField label="Codigo TCK" value={entry.codigo_tck} tickets={tickets} onChange={(value) => patch({ codigo_tck: value })} />
        <label>
          Fecha de reporte
          <input type="date" value={entry.fecha_reporte} onChange={(e) => patch({ fecha_reporte: e.target.value })} />
        </label>
        <SelectField label="Usuario que reporta" value={entry.usuario_reporta} options={masters.usuariosReporta} onChange={(v) => patch({ usuario_reporta: v })} />
        </div>
      </div>
      <div className="form-band">
        <h3>Clasificacion</h3>
        <div className="grid grid-3 register-classification">
          <SelectField label="Recurso" value={entry.recurso} options={masters.recursos} disabled={profile.role === "trabajador"} onChange={(v) => patch({ recurso: v })} />
          <SelectField label="Aplicativo" value={entry.aplicativo} options={masters.aplicaciones} onChange={(v) => patch({ aplicativo: v })} />
          <MultiSelectField label="Sociedad" value={entry.sociedad} options={masters.sociedades} onChange={(v) => patch({ sociedad: v })} />
        </div>
        <div className="grid grid-2">
          <SelectField label="Tipo de atencion" value={entry.tipo_atencion} options={masters.tiposAtencion} onChange={(v) => patch({ tipo_atencion: v })} />
          <label>
          Horas invertidas
            <input
              type="number"
              min="0.5"
              max="8"
              step="0.5"
              value={entry.horas_invertidas}
              onInvalid={showHourValidation}
              onInput={clearHourValidation}
              onChange={(e) => patch({ horas_invertidas: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>
      <div className="form-band">
        <h3>Estado y fechas</h3>
        <div className="grid grid-3">
          <label>
            Fecha inicio
            <input type="date" value={entry.fecha_inicio} onChange={(e) => patch({ fecha_inicio: e.target.value })} />
          </label>
          <label>
            Fecha fin
            <input type="date" value={entry.fecha_fin} onChange={(e) => patch({ fecha_fin: e.target.value })} />
          </label>
          <SelectField label="Estado TCK" value={entry.estado_tck} options={estados} onChange={(v) => patch({ estado_tck: v as TimeEntry["estado_tck"] })} />
        </div>
        <div className="grid grid-2">
          <SelectField label="¿Es un servicio de integración?" value={entry.en_servicio} options={siNo} onChange={(v) => patch({ en_servicio: v as "Si" | "No" })} />
          <SelectField label="Aplicativo se encuentra operativo" value={entry.aplicativo_se_encuentra} options={siNo} onChange={(v) => patch({ aplicativo_se_encuentra: v as "Si" | "No" })} />
        </div>
      </div>
      <div className="form-band">
        <h3>Detalle</h3>
        <label>
          Descripcion
          <textarea value={entry.descripcion} onChange={(e) => patch({ descripcion: e.target.value })} />
        </label>
      </div>
      {saveMessage && <div className="notice">{saveMessage}</div>}
      <button><Save size={16} /> Guardar registro</button>
    </form>
  );
}

function Bulk({ profile, masters, tickets, onSaved }: { profile: Profile; masters: MasterData; tickets: Ticket[]; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseBulkText(text, masters, tickets, profile) : { records: [], errors: [] }), [text, masters, tickets, profile]);
  const blocked = profile.role === "trabajador" && parsed.records.some((record) => record.recurso !== profile.resource_name);

  async function save() {
    if (blocked || parsed.errors.length || !parsed.records.length) return;
    await saveEntries(parsed.records);
    setSaveMessage(`Carga masiva guardada con exito. Registros: ${parsed.records.length}.`);
    setText("");
    onSaved();
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Carga masiva</h2>
          <p className="muted">Descarga la plantilla para copiar/pegar las filas (incluyendo los titulos). El sistema validara el registro y mostrara los registros validos o con errores.</p>
        </div>
        <div className="toolbar">
          <button className="secondary" type="button" onClick={() => downloadBulkTemplate(masters, profile)}>
            <Download size={16} /> Descargar plantilla Excel
          </button>
          <button className="secondary" type="button" onClick={() => { setText(""); setSaveMessage(""); }}>
            <X size={16} /> Limpiar campo
          </button>
        </div>
      </div>
      <label>
        Pega aqui los datos copiados desde Excel
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="fecha_reporte	codigo_tck	usuario_reporta	..." />
      </label>
      {parsed.errors.length > 0 && <div className="notice">{parsed.errors.slice(0, 10).map((error) => <p key={error}>{error}</p>)}</div>}
      {blocked && <div className="notice">La carga contiene registros de otro recurso.</div>}
      {saveMessage && <div className="notice">{saveMessage}</div>}
      <div className="toolbar">
        <span className="pill">Registros validos: {parsed.records.length}</span>
        <span className="pill muted-pill">Errores: {parsed.errors.length}</span>
      </div>
      {parsed.records.length > 0 && (
        <div className="card table-card">
          <div className="section-head compact">
            <h3>Vista previa</h3>
            <span className="muted">Primeros {Math.min(parsed.records.length, 20)} registros</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>TCK</th><th>Usuario</th><th>Recurso</th><th>Aplicativo</th><th>Sociedad</th><th>Horas</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {parsed.records.slice(0, 20).map((record) => (
                <tr key={record.id}>
                  <td>{record.fecha_reporte}</td>
                  <td>{record.codigo_tck}</td>
                  <td>{record.usuario_reporta}</td>
                  <td>{record.recurso}</td>
                  <td>{record.aplicativo}</td>
                  <td>{record.sociedad}</td>
                  <td>{record.horas_invertidas}</td>
                  <td><span className={`status ${record.estado_tck === "Cerrado" ? "closed" : "progress"}`}>{record.estado_tck}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button disabled={blocked || parsed.errors.length > 0 || parsed.records.length === 0} onClick={save}>Guardar carga masiva</button>
    </section>
  );
}

function Dashboard({ entries, teams }: { entries: TimeEntry[]; teams: Team[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [teamId, setTeamId] = useState("Todos");
  const [expectedHours, setExpectedHours] = useState(176);

  const selectedTeam = teams.find((team) => team.id === teamId) ?? null;
  const monthEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!entry.fecha_reporte.startsWith(month)) return false;
      if (selectedTeam && !selectedTeam.resources.includes(entry.recurso)) return false;
      return true;
    });
  }, [entries, month, selectedTeam]);

  const chartRows = useMemo(() => {
    const totals = new Map<string, number>();
    monthEntries.forEach((entry) => {
      totals.set(entry.recurso, (totals.get(entry.recurso) ?? 0) + Number(entry.horas_invertidas));
    });

    const resources = selectedTeam
      ? selectedTeam.resources
      : Array.from(totals.keys()).sort((a, b) => a.localeCompare(b));

    return resources
      .map((resource) => ({ resource, hours: Number((totals.get(resource) ?? 0).toFixed(2)) }))
      .sort((a, b) => b.hours - a.hours || a.resource.localeCompare(b.resource));
  }, [monthEntries, selectedTeam]);

  const maxHours = Math.max(expectedHours, ...chartRows.map((row) => row.hours), 1);
  const chartTrackTop = 78;
  const chartTrackHeight = 220;
  const expectedRatio = Math.max(0, Math.min(1, expectedHours / maxHours));
  const expectedLineTop = `${chartTrackTop + (1 - expectedRatio) * chartTrackHeight}px`;
  const totalHours = chartRows.reduce((sum, row) => sum + row.hours, 0);
  const belowExpected = chartRows.filter((row) => row.hours < expectedHours).length;

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Horas registradas por recurso durante el mes seleccionado.</p>
        </div>
        <div className="toolbar">
          <span className="pill">Recursos: {chartRows.length}</span>
          <span className="pill muted-pill">Horas: {Number(totalHours.toFixed(2))}</span>
          <span className="pill muted-pill">Debajo esperado: {belowExpected}</span>
        </div>
      </div>

      <div className="card grid">
        <div className="grid grid-3 filters">
          <label>
            Mes
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <label>
            Equipo
            <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="Todos">Todos</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>
          <label>
            Horas esperadas
            <input
              type="number"
              min="0"
              step="1"
              value={expectedHours}
              onChange={(event) => setExpectedHours(Number(event.target.value))}
            />
          </label>
        </div>
      </div>

      <div className="card dashboard-card">
        <div className="section-head compact">
          <div>
            <h3>Total de HH registradas {selectedTeam ? `- ${selectedTeam.name}` : ""}</h3>
            <p className="muted">Horas esperadas para el mes: {expectedHours} hh por recurso.</p>
          </div>
        </div>
        <div className="dashboard-chart" style={{ "--expected-top": expectedLineTop } as React.CSSProperties}>
          <div className="expected-line">
            <span>{expectedHours}</span>
          </div>
          {chartRows.map((row) => {
            const height = `${(row.hours / maxHours) * 100}%`;
            return (
              <div className="dashboard-bar-item" key={row.resource}>
                <span className="bar-value">{row.hours}</span>
                <div className="dashboard-bar-track">
                  <div
                    className={row.hours >= expectedHours ? "dashboard-bar ok" : "dashboard-bar"}
                    style={{ "--bar-height": height } as React.CSSProperties}
                  />
                </div>
                <span className="bar-label">{row.resource}</span>
              </div>
            );
          })}
          {chartRows.length === 0 && <p className="muted">No hay horas registradas para esos filtros.</p>}
        </div>
      </div>
    </section>
  );
}

function Entries({ profile, masters, tickets, entries, onChanged }: { profile: Profile; masters: MasterData; tickets: Ticket[]; entries: TimeEntry[]; onChanged: () => void }) {
  const [resourceFilter, setResourceFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [codeFilter, setCodeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editMessage, setEditMessage] = useState("");

  const resources = useMemo(() => Array.from(new Set(entries.map((entry) => entry.recurso))).sort(), [entries]);
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (resourceFilter !== "Todos" && entry.recurso !== resourceFilter) return false;
      if (statusFilter !== "Todos" && entry.estado_tck !== statusFilter) return false;
      if (codeFilter && !entry.codigo_tck.toLowerCase().includes(codeFilter.toLowerCase())) return false;
      if (fromDate && entry.fecha_reporte < fromDate) return false;
      if (toDate && entry.fecha_reporte > toDate) return false;
      return true;
    });
  }, [entries, resourceFilter, statusFilter, codeFilter, fromDate, toDate]);

  async function remove(id: string) {
    await deleteEntry(id);
    onChanged();
  }

  function clearFilters() {
    setResourceFilter("Todos");
    setStatusFilter("Todos");
    setCodeFilter("");
    setFromDate("");
    setToDate("");
  }

  function patchEditing(values: Partial<TimeEntry>) {
    setEditingEntry((current) => (current ? { ...current, ...values } : current));
  }

  async function saveEditedEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!editingEntry) return;
    if (!editingEntry.codigo_tck || !editingEntry.sociedad || !editingEntry.horas_invertidas) {
      setEditMessage("Completa TCK, sociedad y horas antes de guardar.");
      return;
    }
    if (!tickets.some((ticket) => ticketMatchesEntry(ticket, editingEntry, profile))) {
      setEditMessage("Selecciona un ticket existente asignado a tu usuario.");
      return;
    }
    if (editingEntry.horas_invertidas <= 0 || editingEntry.horas_invertidas > 8) {
      setEditMessage(hourValidationMessage);
      return;
    }
    await saveEntry({
      ...editingEntry,
      codigo_tck: editingEntry.codigo_tck.toUpperCase(),
      modificado: new Date().toISOString()
    });
    setEditingEntry(null);
    setEditMessage("");
    onChanged();
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Listado de Atenciones</h2>
          <p className="muted">{profile.role === "trabajador" ? "Solo ves registros asociados a tu recurso." : "Vista completa de administracion."}</p>
        </div>
        <div className="toolbar">
          <span className="pill">Registros: {filteredEntries.length}</span>
          <span className="pill muted-pill">Horas: {filteredEntries.reduce((sum, entry) => sum + Number(entry.horas_invertidas), 0)}</span>
          <button className="secondary" type="button" disabled={!filteredEntries.length} onClick={() => exportEntriesCsv(filteredEntries)}>
            <Download size={16} /> Exportar CSV
          </button>
          <button className="secondary" type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>
      <div className="card grid">
        <div className="grid grid-5 filters">
          <SelectField label="Recurso" value={resourceFilter} options={["Todos", ...resources]} onChange={setResourceFilter} />
          <SelectField label="Estado" value={statusFilter} options={["Todos", ...estados]} onChange={setStatusFilter} />
          <label>
            Codigo TCK
            <div className="input-with-icon">
              <Search size={16} />
              <input value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} placeholder="Buscar..." />
            </div>
          </label>
          <label>
            Desde
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>
      </div>
      {editingEntry && (
        <form className="card grid" onSubmit={saveEditedEntry}>
          <div className="section-head compact">
            <div>
              <h3>Editar atencion</h3>
              <p className="muted">{editingEntry.codigo_tck}</p>
            </div>
            <button className="secondary icon-button" type="button" onClick={() => { setEditingEntry(null); setEditMessage(""); }} title="Cerrar edicion">
              <X size={16} />
            </button>
          </div>
          {editMessage && <div className="notice">{editMessage}</div>}
          <div className="grid grid-3">
            <TicketCodeField label="Codigo TCK" value={editingEntry.codigo_tck} tickets={tickets} onChange={(value) => patchEditing({ codigo_tck: value })} />
            <label>
              Fecha reporte
              <input type="date" value={editingEntry.fecha_reporte} onChange={(e) => patchEditing({ fecha_reporte: e.target.value })} />
            </label>
            <SelectField label="Usuario que reporta" value={editingEntry.usuario_reporta} options={masters.usuariosReporta} onChange={(v) => patchEditing({ usuario_reporta: v })} />
          </div>
          <div className="grid grid-3">
            <SelectField label="Recurso" value={editingEntry.recurso} options={masters.recursos} disabled={profile.role === "trabajador"} onChange={(v) => patchEditing({ recurso: v })} />
            <SelectField label="Aplicativo" value={editingEntry.aplicativo} options={masters.aplicaciones} onChange={(v) => patchEditing({ aplicativo: v })} />
            <MultiSelectField label="Sociedad" value={editingEntry.sociedad} options={masters.sociedades} onChange={(v) => patchEditing({ sociedad: v })} />
          </div>
          <div className="grid grid-2">
            <SelectField label="Tipo de atencion" value={editingEntry.tipo_atencion} options={masters.tiposAtencion} onChange={(v) => patchEditing({ tipo_atencion: v })} />
            <label>
              Horas invertidas
              <input
                type="number"
                min="0.5"
                max="8"
                step="0.5"
                value={editingEntry.horas_invertidas}
                onInvalid={showHourValidation}
                onInput={clearHourValidation}
                onChange={(e) => patchEditing({ horas_invertidas: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="grid grid-3">
            <label>
              Fecha inicio
              <input type="date" value={editingEntry.fecha_inicio} onChange={(e) => patchEditing({ fecha_inicio: e.target.value })} />
            </label>
            <label>
              Fecha fin
              <input type="date" value={editingEntry.fecha_fin ?? ""} onChange={(e) => patchEditing({ fecha_fin: e.target.value })} />
            </label>
            <SelectField label="Estado TCK" value={editingEntry.estado_tck} options={estados} onChange={(v) => patchEditing({ estado_tck: v as TimeEntry["estado_tck"] })} />
          </div>
          <div className="grid grid-2">
            <SelectField label="Es un servicio de la empresa" value={editingEntry.en_servicio} options={siNo} onChange={(v) => patchEditing({ en_servicio: v as "Si" | "No" })} />
            <SelectField label="Aplicativo se encuentra operativo" value={editingEntry.aplicativo_se_encuentra} options={siNo} onChange={(v) => patchEditing({ aplicativo_se_encuentra: v as "Si" | "No" })} />
          </div>
          <label>
            Descripcion
            <textarea value={editingEntry.descripcion ?? ""} onChange={(e) => patchEditing({ descripcion: e.target.value })} />
          </label>
          <button><Save size={16} /> Guardar cambios</button>
        </form>
      )}
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              {entryExportHeaders.map((header) => <th key={header.key}>{header.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr key={entry.id}>
                {entryExportHeaders.map((header) => (
                  <td key={header.key} className={header.key === "descripcion" ? "description-cell" : ""}>
                    {header.key === "estado_tck" ? (
                      <span className={`status ${entry.estado_tck === "Cerrado" ? "closed" : "progress"}`}>{entry.estado_tck}</span>
                    ) : (
                      String(entry[header.key] ?? "")
                    )}
                  </td>
                ))}
                <td>
                  <div className="row-actions">
                    <button className="secondary icon-button" onClick={() => { setEditingEntry(entry); setEditMessage(""); }} title="Editar atencion">
                      <Pencil size={16} />
                    </button>
                    <button className="secondary icon-button" onClick={() => remove(entry.id)} title="Eliminar atencion">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredEntries.length === 0 && <p className="muted">No hay registros con esos filtros.</p>}
      </div>
    </section>
  );
}

function Admin({
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
    role: "trabajador",
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
      role: "trabajador",
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
                  <option value="trabajador">trabajador</option>
                  <option value="administracion">administracion</option>
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
              <thead><tr><th>Correo</th><th>Nombre</th><th>Rol</th><th>Recurso</th><th>Estado</th></tr></thead>
              <tbody>
                {localProfiles.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}{user.id === currentUser.id ? <span className="self-tag">Tu usuario</span> : null}</td>
                    <td>{user.display_name}</td>
                    <td>{user.role}</td>
                    <td>{user.resource_name ?? "-"}</td>
                    <td><span className={`status ${user.active ? "closed" : "progress"}`}>{user.active ? "Activo" : "Inactivo"}</span></td>
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
