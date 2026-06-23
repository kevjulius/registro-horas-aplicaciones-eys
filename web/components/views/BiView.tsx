"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Pencil, Save, Search, Trash2, X } from "lucide-react";
import { LoadingOverlay, SelectField, clearHourValidation, hourValidationMessage, showHourValidation, today, useAutoDismissNotice } from "@/components/app-shared";
import { deleteBiEntry, saveBiEntry } from "@/lib/repository";
import type { BiEntry, BiMasterData, Profile } from "@/lib/types";

function emptyBiEntry(profile: Profile, masters: BiMasterData): BiEntry {
  return {
    id: `new-${crypto.randomUUID()}`,
    correlativo: "",
    asignado_a: profile.role === "trabajador_bi" ? profile.resource_name ?? "" : masters.recursos[0] ?? "",
    formato: masters.formatos[0] ?? "",
    solicitado_por: "",
    servicio: masters.servicios[0] ?? "",
    tipo_atencion: masters.atenciones[0]?.name ?? "",
    estado: masters.estados[0] ?? "",
    fecha_inicio: today(),
    fecha_fin: today(),
    esfuerzo_horas: 0,
    descripcion: "",
    active: true
  };
}

export function BiView({
  profile,
  masters,
  entries,
  onChanged
}: {
  profile: Profile;
  masters: BiMasterData;
  entries: BiEntry[];
  onChanged: () => void;
}) {
  const [entry, setEntry] = useState<BiEntry>(() => emptyBiEntry(profile, masters));
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isBusy, setIsBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [resourceFilter, setResourceFilter] = useState("Todos");
  const [stateFilter, setStateFilter] = useState("Todos");
  const [serviceFilter, setServiceFilter] = useState("Todos");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState<"registro" | "listado">("registro");
  const isEditing = !entry.id.startsWith("new-");

  const clearMessage = useCallback(() => setMessage(""), []);
  useAutoDismissNotice(message, clearMessage);

  function notify(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((item) => [
      item.asignado_a,
      item.formato,
      item.solicitado_por,
      item.servicio,
      item.tipo_atencion,
      item.estado,
      item.descripcion
    ].join(" ").toLowerCase().includes(term)
      && (resourceFilter === "Todos" || item.asignado_a === resourceFilter)
      && (stateFilter === "Todos" || item.estado === stateFilter)
      && (serviceFilter === "Todos" || item.servicio === serviceFilter)
      && (!fromDate || item.fecha_inicio >= fromDate)
      && (!toDate || item.fecha_inicio <= toDate));
  }, [entries, fromDate, resourceFilter, search, serviceFilter, stateFilter, toDate]);

  function csvValue(value: string | number | boolean | null | undefined) {
    return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/;/g, ",").trim();
  }

  function exportCsv() {
    const headers: Array<{ key: keyof BiEntry; label: string }> = [
      { key: "asignado_a", label: "Asignado a" },
      { key: "formato", label: "Formato" },
      { key: "solicitado_por", label: "Solicitado por" },
      { key: "servicio", label: "Servicio" },
      { key: "tipo_atencion", label: "Tipo atencion" },
      { key: "estado", label: "Estado" },
      { key: "fecha_inicio", label: "Fecha inicio" },
      { key: "fecha_fin", label: "Fecha fin" },
      { key: "esfuerzo_horas", label: "Horas" },
      { key: "descripcion", label: "Descripcion" }
    ];
    const rows = [
      headers.map((header) => csvValue(header.label)).join(";"),
      ...filteredEntries.map((item) => headers.map((header) => csvValue(item[header.key])).join(";"))
    ];
    const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `registros_bi_${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearch("");
    setResourceFilter("Todos");
    setStateFilter("Todos");
    setServiceFilter("Todos");
    setFromDate("");
    setToDate("");
  }

  function patch(values: Partial<BiEntry>) {
    setEntry((current) => ({ ...current, ...values }));
  }

  function resetForm() {
    setEntry(emptyBiEntry(profile, masters));
  }

  function editEntry(item: BiEntry) {
    setEntry(item);
    setMessage("");
    setView("registro");
  }

  async function removeEntry(item: BiEntry) {
    try {
      setIsBusy(true);
      await deleteBiEntry(item.id);
      notify("Registro BI eliminado con exito.", "success");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo eliminar registro BI.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const required = [
      entry.asignado_a,
      entry.formato,
      entry.solicitado_por,
      entry.servicio,
      entry.tipo_atencion,
      entry.estado,
      entry.fecha_inicio,
      entry.fecha_fin,
      entry.esfuerzo_horas,
      entry.descripcion
    ];
    if (required.some((value) => !String(value ?? "").trim())) {
      notify("Completa todos los campos BI antes de guardar.", "error");
      return;
    }
    if (entry.esfuerzo_horas <= 0 || entry.esfuerzo_horas > 8) {
      notify(hourValidationMessage, "error");
      return;
    }
    try {
      setIsBusy(true);
      await saveBiEntry(entry);
      notify(isEditing ? "Registro BI actualizado con exito." : "Registro BI guardado con exito.", "success");
      resetForm();
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "No se pudo guardar registro BI.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="grid">
      <LoadingOverlay show={isBusy} />
      <div className="section-head">
        <div>
          <h2>Registro BI</h2>
          <p className="muted">Registra horas BI sin flujo de tickets ni aprobaciones.</p>
        </div>
        <div className="segmented">
          <button className={view === "registro" ? "active" : ""} type="button" disabled={isBusy} onClick={() => setView("registro")}>Registrar BI</button>
          <button className={view === "listado" ? "active" : ""} type="button" disabled={isBusy} onClick={() => setView("listado")}>Listado BI</button>
        </div>
      </div>
      {message && <div className={`notice ${messageType}`}>{message}</div>}

      {view === "registro" && (
        <form className="card grid register-card" onSubmit={submit}>
          <div className="section-head compact register-title">
            <div>
              <h3>{isEditing ? "Editar registro BI" : "Nuevo registro BI"}</h3>
              <p className="muted">El correlativo se generara automaticamente al guardar.</p>
            </div>
            {isEditing && (
              <button className="secondary icon-button" type="button" disabled={isBusy} onClick={resetForm} title="Cancelar edicion">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="form-band">
            <h3>Datos generales</h3>
            <div className="grid grid-2">
              <SelectField label="Asignado a" value={entry.asignado_a} options={masters.recursos} disabled={profile.role === "trabajador_bi"} onChange={(value) => patch({ asignado_a: value })} />
              <SelectField label="Formato" value={entry.formato} options={masters.formatos} onChange={(value) => patch({ formato: value })} />
            </div>
          </div>
          <div className="form-band">
            <h3>Clasificacion</h3>
            <div className="grid grid-3">
              <label>
                Solicitado por
                <input value={entry.solicitado_por} onChange={(event) => patch({ solicitado_por: event.target.value })} />
              </label>
              <SelectField label="Servicio" value={entry.servicio} options={masters.servicios} onChange={(value) => patch({ servicio: value })} />
              <SelectField label="Tipo atencion" value={entry.tipo_atencion} options={masters.atenciones.map((item) => item.name)} onChange={(value) => patch({ tipo_atencion: value })} />
              <SelectField label="Estado" value={entry.estado} options={masters.estados} onChange={(value) => patch({ estado: value })} />
              <label>
                Fecha inicio
                <input type="date" value={entry.fecha_inicio} onChange={(event) => patch({ fecha_inicio: event.target.value })} />
              </label>
              <label>
                Fecha fin
                <input type="date" value={entry.fecha_fin} onChange={(event) => patch({ fecha_fin: event.target.value })} />
              </label>
              <label>
                Esfuerzo (Cant Horas)
                <input
                  type="number"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={entry.esfuerzo_horas}
                  onInvalid={showHourValidation}
                  onInput={clearHourValidation}
                  onChange={(event) => patch({ esfuerzo_horas: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>
          <div className="form-band">
            <h3>Detalle</h3>
            <label>
              Descripcion
              <textarea value={entry.descripcion} onChange={(event) => patch({ descripcion: event.target.value })} />
            </label>
          </div>
          <button disabled={isBusy}><Save size={16} /> {isEditing ? "Actualizar BI" : "Guardar BI"}</button>
        </form>
      )}

      {view === "listado" && (
        <div className="grid">
          <div className="card grid">
            <div className="grid grid-6 filters">
              <label>
                Buscar
                <div className="input-with-icon">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recurso, servicio, descripcion..." />
                </div>
              </label>
              <SelectField label="Asignado a" value={resourceFilter} options={["Todos", ...masters.recursos]} onChange={setResourceFilter} />
              <SelectField label="Estado" value={stateFilter} options={["Todos", ...masters.estados]} onChange={setStateFilter} />
              <SelectField label="Servicio" value={serviceFilter} options={["Todos", ...masters.servicios]} onChange={setServiceFilter} />
              <label>
                Desde
                <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
              </label>
              <label>
                Hasta
                <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
              </label>
            </div>
            <div className="toolbar">
              <span className="pill">Registros: {filteredEntries.length}</span>
              <span className="pill muted-pill">Horas: {filteredEntries.reduce((sum, item) => sum + Number(item.esfuerzo_horas), 0)}</span>
              <button className="secondary" type="button" disabled={!filteredEntries.length || isBusy} onClick={exportCsv}><Download size={16} /> Exportar CSV</button>
              <button className="secondary" type="button" disabled={isBusy} onClick={clearFilters}>Limpiar filtros</button>
            </div>
          </div>
          <div className="card table-card">
            <table>
            <thead>
              <tr>
                <th>Asignado a</th>
                <th>Formato</th>
                <th>Solicitado por</th>
                <th>Servicio</th>
                <th>Tipo atencion</th>
                <th>Estado</th>
                <th>Fecha inicio</th>
                <th>Fecha fin</th>
                <th>Horas</th>
                <th>Descripcion</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((item) => (
                <tr key={item.id}>
                  <td>{item.asignado_a}</td>
                  <td>{item.formato}</td>
                  <td>{item.solicitado_por}</td>
                  <td>{item.servicio}</td>
                  <td>{item.tipo_atencion}</td>
                  <td><span className="status progress">{item.estado}</span></td>
                  <td>{item.fecha_inicio}</td>
                  <td>{item.fecha_fin}</td>
                  <td>{item.esfuerzo_horas}</td>
                  <td className="description-cell">{item.descripcion}</td>
                  <td>
                    <div className="row-actions">
                      <button className="secondary icon-button" type="button" disabled={isBusy} onClick={() => editEntry(item)} title="Editar BI">
                        <Pencil size={16} />
                      </button>
                      <button className="secondary icon-button" type="button" disabled={isBusy} onClick={() => removeEntry(item)} title="Eliminar BI">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 && <p className="muted">No hay registros BI.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
