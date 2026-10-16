"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FilterX, Pencil, RefreshCw, Save, Search, X } from "lucide-react";
import { LoadingOverlay, MultiDropdownField, MultiSelectField, SearchableField, SelectField, today, useAutoDismissNotice } from "@/components/app-shared";
import { loadProjectIdeas, saveProjectIdea } from "@/lib/repository";
import { cleanProjectIdeaUpdate, projectAttentionStatuses, quotationStatuses } from "@/lib/project-ideas";
import type { ProjectIdea, ProjectIdeaCatalogs } from "@/lib/types";

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const number = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
function dateLabel(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}
function csvValue(value: string | number | null) {
  const text = String(value ?? "");
  return `"${(/^[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
}

export function ProjectIdeasView({ refreshVersion, canEdit }: { refreshVersion: number; canEdit: boolean }) {
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [catalogs, setCatalogs] = useState<ProjectIdeaCatalogs>({ sociedades: [], solicitantes: [], responsables: [] });
  const [editing, setEditing] = useState<ProjectIdea | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [search, setSearch] = useState("");
  const [quotation, setQuotation] = useState("Todos");
  const [attention, setAttention] = useState("Todos");
  const [company, setCompany] = useState("Todos");
  const [responsible, setResponsible] = useState("Todos");
  const clearMessage = useCallback(() => setMessage(""), []);
  useAutoDismissNotice(message, clearMessage);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await loadProjectIdeas();
      setIdeas(data.ideas);
      setCatalogs(data.catalogs ?? { sociedades: [], solicitantes: [], responsables: [] });
    }
    catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el listado.");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refreshVersion, refresh]);

  const companies = useMemo(() => Array.from(new Set(ideas.map((idea) => idea.sociedad))).sort(), [ideas]);
  const responsibles = useMemo(() => Array.from(new Set(ideas.flatMap((idea) => idea.responsables))).sort(), [ideas]);
  const editSocieties = Array.from(new Set([...catalogs.sociedades,
    ...(editing?.sociedad.split("|").map((name) => name.trim()).filter(Boolean) ?? [])])).sort();
  const editResponsibles = Array.from(new Set([...catalogs.responsables, ...(editing?.responsables ?? [])])).sort();
  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase();
    return ideas.filter((idea) => (quotation === "Todos" || idea.estado_cotizacion === quotation)
      && (attention === "Todos" || idea.estado_atencion === attention)
      && (company === "Todos" || idea.sociedad === company)
      && (responsible === "Todos" || idea.responsables.includes(responsible))
      && (!text || [idea.correlativo, idea.ticket_code, idea.alcance_proyecto, idea.titulo_correo,
        idea.usuario_solicitante, idea.bloqueantes].some((value) => value.toLowerCase().includes(text))));
  }, [ideas, search, quotation, attention, company, responsible]);

  function clearFilters() {
    setSearch(""); setQuotation("Todos"); setAttention("Todos"); setCompany("Todos"); setResponsible("Todos");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || busy || !canEdit) return;
    try {
      const values = cleanProjectIdeaUpdate(editing);
      setBusy(true);
      await saveProjectIdea(editing.id, values);
      setIdeas((current) => current.map((idea) => idea.id === editing.id ? { ...idea, ...values } : idea));
      setEditing(null);
      setMessageType("success");
      setMessage(`${editing.correlativo}: cambios guardados con exito.`);
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la idea.");
    } finally { setBusy(false); }
  }

  function exportCsv() {
    const headers = ["Correlativo", "Ticket", "Alcance Proyecto", "Titulo de Correo", "Sociedad / empresa",
      "Usuario solicitante", "Responsables de la atencion", "Cantidad HH estimacion", "Cantidad HH reales", "Costo cotizacion (S/)",
      "Estado cotizacion", "Fecha inicio", "Fecha fin", "Estado de la atencion", "Bloqueantes identificados"];
    const rows = [headers.map(csvValue).join(";"), ...filtered.map((idea) => [
      idea.correlativo, idea.ticket_code, idea.alcance_proyecto, idea.titulo_correo, idea.sociedad,
      idea.usuario_solicitante, idea.responsables.join("; "), idea.horas_estimacion, idea.horas_reales, idea.costo_cotizacion,
      idea.estado_cotizacion, idea.fecha_inicio, idea.fecha_fin, idea.estado_atencion, idea.bloqueantes
    ].map(csvValue).join(";"))];
    const url = URL.createObjectURL(new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `ideas_proyecto_${today()}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }

  function patch(values: Partial<ProjectIdea>) {
    setEditing((current) => current ? { ...current, ...values } : null);
  }

  return (
    <section className="grid project-ideas">
      <LoadingOverlay show={busy} />
      <div className="section-head">
        <h2>Ideas de Proyecto</h2>
        <div className="toolbar">
          <span className="pill">Registros: {filtered.length}</span>
          <button type="button" className="secondary icon-button" title="Refrescar listado" aria-label="Refrescar listado" disabled={busy} onClick={refresh}><RefreshCw size={16} /></button>
          <button type="button" className="secondary" disabled={busy || !filtered.length} onClick={exportCsv}><Download size={16} /> Exportar CSV</button>
          <button type="button" className="secondary" disabled={busy} onClick={clearFilters}><FilterX size={16} /> Limpiar filtros</button>
        </div>
      </div>
      {message && <div role={messageType === "error" ? "alert" : "status"} className={`notice ${messageType}`}>{message}</div>}
      <div className="card grid grid-5 filters">
        <label>Buscar<div className="input-with-icon"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} /></div></label>
        <SelectField label="Estado cotizacion" options={["Todos", ...quotationStatuses]} value={quotation} onChange={setQuotation} />
        <SelectField label="Estado atencion" options={["Todos", ...projectAttentionStatuses]} value={attention} onChange={setAttention} />
        <SelectField label="Sociedad / empresa" options={["Todos", ...companies]} value={company} onChange={setCompany} />
        <SelectField label="Responsable" options={["Todos", ...responsibles]} value={responsible} onChange={setResponsible} />
      </div>

      {editing && canEdit && (
        <form className="card grid project-idea-editor" onSubmit={save}>
          <div className="section-head compact">
            <h3>{editing.correlativo} · {editing.ticket_code}</h3>
            <button className="secondary icon-button" type="button" title="Cerrar edicion" aria-label="Cerrar edicion" disabled={busy} onClick={() => setEditing(null)}><X size={16} /></button>
          </div>
          <div className="grid grid-2">
            <label>Correlativo<input readOnly value={editing.correlativo} /></label>
            <label>Ticket<input readOnly value={editing.ticket_code} /></label>
          </div>
          <fieldset disabled={busy} className="project-idea-fields grid grid-2 project-planning-fields">
            <label>Alcance Proyecto *<textarea required value={editing.alcance_proyecto} onChange={(event) => patch({ alcance_proyecto: event.target.value })} /></label>
            <label>Titulo de Correo *<input required value={editing.titulo_correo} onChange={(event) => patch({ titulo_correo: event.target.value })} /></label>
            <MultiSelectField label="Sociedad / empresa *" value={editing.sociedad} options={editSocieties} onChange={(sociedad) => patch({ sociedad })} />
            <SearchableField label="Usuario solicitante *" value={editing.usuario_solicitante} options={catalogs.solicitantes} onChange={(usuario_solicitante) => patch({ usuario_solicitante })} />
            <MultiDropdownField label="Responsables de la atencion *" selected={editing.responsables} options={editResponsibles}
              onToggle={(resource) => patch({ responsables: editing.responsables.includes(resource)
                ? editing.responsables.filter((name) => name !== resource) : [...editing.responsables, resource] })} />
          </fieldset>
          <fieldset disabled={busy} className="project-idea-fields grid grid-3">
            <label>Cantidad HH estimacion<input type="number" min="0" max="9999999999.99" step="0.01" value={editing.horas_estimacion ?? ""} onChange={(event) => patch({ horas_estimacion: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            <label>Cantidad HH reales<input type="number" min="0" max="9999999999.99" step="0.01" value={editing.horas_reales ?? ""} onChange={(event) => patch({ horas_reales: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            <label>Costo cotizacion (S/)<input type="number" min="0" max="9999999999.99" step="0.01" value={editing.costo_cotizacion ?? ""} onChange={(event) => patch({ costo_cotizacion: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            <SelectField label="Estado cotizacion" value={editing.estado_cotizacion} options={quotationStatuses} onChange={(value) => patch({ estado_cotizacion: value as ProjectIdea["estado_cotizacion"] })} />
            <label>Fecha inicio<input type="date" value={editing.fecha_inicio ?? ""} max={editing.fecha_fin ?? undefined} onChange={(event) => patch({ fecha_inicio: event.target.value || null })} /></label>
            <label>Fecha fin<input type="date" value={editing.fecha_fin ?? ""} min={editing.fecha_inicio ?? undefined} onChange={(event) => patch({ fecha_fin: event.target.value || null })} /></label>
            <SelectField label="Estado de la atencion" value={editing.estado_atencion} options={projectAttentionStatuses} onChange={(value) => patch({ estado_atencion: value as ProjectIdea["estado_atencion"] })} />
          </fieldset>
          <label>Bloqueantes identificados<textarea disabled={busy} value={editing.bloqueantes} onChange={(event) => patch({ bloqueantes: event.target.value })} /></label>
          <div className="toolbar"><button disabled={busy} type="submit"><Save size={16} /> Guardar cambios</button><button disabled={busy} className="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button></div>
        </form>
      )}

      <div className={`card table-card project-ideas-table${canEdit ? " can-edit" : ""}`}>
        <table>
          <colgroup>{[112, 118, 280, 240, 190, 170, 210, 110, 110, 130, 140, 115, 115, 170, 260, 64].slice(0, canEdit ? 16 : 15).map((width, index) => <col key={index} style={{ width }} />)}</colgroup>
          <thead><tr>{["Correlativo", "Ticket", "Alcance Proyecto", "Titulo de Correo", "Sociedad / empresa", "Usuario solicitante", "Responsables", "HH estimacion", "Cantidad HH reales", "Costo (S/)", "Estado cotizacion", "Fecha inicio", "Fecha fin", "Estado atencion", "Bloqueantes", ""].slice(0, canEdit ? 16 : 15).map((label, index) => <th key={index} scope="col">{label}</th>)}</tr></thead>
          <tbody>
            {(editing ? filtered.filter((idea) => idea.id === editing.id) : filtered).map((idea) => (
              <tr key={idea.id}>
                <td>{idea.correlativo}</td><td>{idea.ticket_code}</td><td>{idea.alcance_proyecto}</td><td>{idea.titulo_correo}</td>
                <td>{idea.sociedad}</td><td>{idea.usuario_solicitante}</td><td>{idea.responsables.join("; ")}</td>
                <td>{idea.horas_estimacion === null ? "—" : number.format(idea.horas_estimacion)}</td>
                <td>{idea.horas_reales == null ? "—" : number.format(idea.horas_reales)}</td>
                <td>{idea.costo_cotizacion === null ? "—" : money.format(idea.costo_cotizacion)}</td>
                <td>{idea.estado_cotizacion}</td><td>{dateLabel(idea.fecha_inicio)}</td><td>{dateLabel(idea.fecha_fin)}</td>
                <td>{idea.estado_atencion}</td><td>{idea.bloqueantes || "—"}</td>
                {canEdit && <td><button className="secondary icon-button" title={`Editar ${idea.correlativo}`} aria-label={`Editar ${idea.correlativo}`} disabled={busy} type="button" onClick={() => setEditing({ ...idea })}><Pencil size={16} /></button></td>}
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={canEdit ? 16 : 15}>No hay ideas de proyecto para los filtros seleccionados.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
