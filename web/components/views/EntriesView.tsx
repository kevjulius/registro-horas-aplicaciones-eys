"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Pencil, Save, Search, Trash2, X } from "lucide-react";
import {
  clearHourValidation,
  estados,
  hourValidationMessage,
  LoadingOverlay,
  SelectField,
  showHourValidation,
  ticketMatchesEntry,
  today,
  useAutoDismissNotice
} from "@/components/app-shared";
import { deleteEntry, saveEntry } from "@/lib/repository";
import { ticketPeriodValidationMessage } from "@/lib/ticket-period";
import type { MasterData, Profile, Ticket, TimeEntry } from "@/lib/types";

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

export function EntriesView({ profile, masters, tickets, entries, onChanged }: { profile: Profile; masters: MasterData; tickets: Ticket[]; entries: TimeEntry[]; onChanged: () => void }) {
  const defaultResourceFilter = profile.resource_name ?? "Todos";
  const [resourceFilter, setResourceFilter] = useState(defaultResourceFilter);
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [codeFilter, setCodeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [listMessage, setListMessage] = useState("");
  const [editMessageType, setEditMessageType] = useState<"success" | "error">("error");
  const [listMessageType, setListMessageType] = useState<"success" | "error">("success");
  const [isBusy, setIsBusy] = useState(false);
  const [focusedEntryId, setFocusedEntryId] = useState("");
  const approvedTickets = useMemo(() => tickets.filter((ticket) => ticket.approval_status === "Aprobado"), [tickets]);
  const clearListMessage = useCallback(() => setListMessage(""), []);
  const clearEditMessage = useCallback(() => setEditMessage(""), []);
  useAutoDismissNotice(listMessage, clearListMessage);
  useAutoDismissNotice(editMessage, clearEditMessage);

  function notifyList(text: string, type: "success" | "error") {
    setListMessage(text);
    setListMessageType(type);
  }

  function notifyEdit(text: string, type: "success" | "error") {
    setEditMessage(text);
    setEditMessageType(type);
  }

  const resources = useMemo(() => {
    return Array.from(new Set([...entries.map((entry) => entry.recurso), profile.resource_name].filter(Boolean) as string[])).sort();
  }, [entries, profile.resource_name]);
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (focusedEntryId && entry.id !== focusedEntryId) return false;
      if (resourceFilter !== "Todos" && entry.recurso !== resourceFilter) return false;
      if (statusFilter !== "Todos" && entry.estado_tck !== statusFilter) return false;
      if (codeFilter && !entry.codigo_tck.toLowerCase().includes(codeFilter.toLowerCase())) return false;
      if (fromDate && entry.fecha_reporte < fromDate) return false;
      if (toDate && entry.fecha_reporte > toDate) return false;
      return true;
    });
  }, [entries, resourceFilter, statusFilter, codeFilter, fromDate, toDate, focusedEntryId]);

  async function remove(id: string) {
    try {
      setIsBusy(true);
      await deleteEntry(id);
      notifyList("Registro eliminado correctamente.", "success");
      if (editingEntry?.id === id) {
        setEditingEntry(null);
        setEditMessage("");
      }
      if (focusedEntryId === id) {
        setFocusedEntryId("");
      }
      onChanged();
    } catch (error) {
      notifyList(error instanceof Error ? error.message : "No se pudo eliminar el registro.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  function clearFilters() {
    setResourceFilter(defaultResourceFilter);
    setStatusFilter("Todos");
    setCodeFilter("");
    setFromDate("");
    setToDate("");
    setFocusedEntryId("");
  }

  function patchEditing(values: Partial<TimeEntry>) {
    setEditingEntry((current) => (current ? { ...current, ...values } : current));
  }

  async function saveEditedEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!editingEntry) return;
    if (!editingEntry.horas_invertidas) {
      notifyEdit("Completa las horas antes de guardar.", "error");
      return;
    }
    const selectedTicket = approvedTickets.find((ticket) => ticket.codigo_tck.toUpperCase() === editingEntry.codigo_tck.trim().toUpperCase());
    if (selectedTicket) {
      const periodMessage = ticketPeriodValidationMessage(selectedTicket, editingEntry.fecha_reporte);
      if (periodMessage) {
        notifyEdit(periodMessage, "error");
        return;
      }
    }
    if (!approvedTickets.some((ticket) => ticketMatchesEntry(ticket, editingEntry, profile))) {
      notifyEdit("Selecciona un ticket existente, aprobado y asignado a tu usuario.", "error");
      return;
    }
    if (editingEntry.horas_invertidas <= 0 || editingEntry.horas_invertidas > 8) {
      notifyEdit(hourValidationMessage, "error");
      return;
    }
    try {
      setIsBusy(true);
      await saveEntry({
        ...editingEntry,
        codigo_tck: editingEntry.codigo_tck.toUpperCase(),
        modificado: new Date().toISOString()
      });
      setEditingEntry(null);
      setEditMessage("");
      setFocusedEntryId("");
      notifyList("Registro actualizado correctamente.", "success");
      onChanged();
    } catch (error) {
      notifyEdit(error instanceof Error ? error.message : "No se pudo actualizar el registro.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="grid">
      <LoadingOverlay show={isBusy} />
      <div className="section-head">
        <div>
          <h2>Listado de Atenciones</h2>
          <p className="muted">{profile.role === "trabajador" ? "Solo ves registros asociados a tu recurso." : "Vista completa de administracion."}</p>
        </div>
        <div className="toolbar">
          <span className="pill">Registros: {filteredEntries.length}</span>
          <span className="pill muted-pill">Horas: {filteredEntries.reduce((sum, entry) => sum + Number(entry.horas_invertidas), 0)}</span>
          <button className="secondary" type="button" disabled={!filteredEntries.length || isBusy} onClick={() => exportEntriesCsv(filteredEntries)}>
            <Download size={16} /> Exportar CSV
          </button>
          <button className="secondary" type="button" disabled={isBusy} onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>
      <div className="card grid">
        {listMessage && <div className={`notice ${listMessageType}`}>{listMessage}</div>}
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
            <button className="secondary icon-button" type="button" disabled={isBusy} onClick={() => { setEditingEntry(null); setEditMessage(""); setFocusedEntryId(""); }} title="Cerrar edicion">
              <X size={16} />
            </button>
          </div>
          {editMessage && <div className={`notice ${editMessageType}`}>{editMessage}</div>}
          <div className="grid grid-2">
            <label>
              Fecha reporte
              <input type="date" value={editingEntry.fecha_reporte} onChange={(e) => patchEditing({ fecha_reporte: e.target.value })} />
            </label>
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
          <label>
            Descripcion
            <textarea value={editingEntry.descripcion ?? ""} onChange={(e) => patchEditing({ descripcion: e.target.value })} />
          </label>
          <button disabled={isBusy}><Save size={16} /> Guardar cambios</button>
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
                    <button className="secondary icon-button" disabled={isBusy} onClick={() => { setEditingEntry(entry); setEditMessage(""); setListMessage(""); setFocusedEntryId(entry.id); }} title="Editar atencion">
                      <Pencil size={16} />
                    </button>
                    <button className="secondary icon-button" disabled={isBusy} onClick={() => remove(entry.id)} title="Eliminar atencion">
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
