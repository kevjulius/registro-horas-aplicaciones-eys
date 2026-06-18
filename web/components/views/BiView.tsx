"use client";

import { useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { SelectField, clearHourValidation, hourValidationMessage, showHourValidation, today } from "@/components/app-shared";
import { saveBiEntry } from "@/lib/repository";
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
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"registro" | "listado">("registro");

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((item) => [
      item.correlativo,
      item.asignado_a,
      item.formato,
      item.solicitado_por,
      item.servicio,
      item.tipo_atencion,
      item.estado,
      item.descripcion
    ].join(" ").toLowerCase().includes(term));
  }, [entries, search]);

  function patch(values: Partial<BiEntry>) {
    setEntry((current) => ({ ...current, ...values }));
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
      setMessage("Completa todos los campos BI antes de guardar.");
      return;
    }
    if (entry.esfuerzo_horas <= 0 || entry.esfuerzo_horas > 8) {
      setMessage(hourValidationMessage);
      return;
    }
    try {
      await saveBiEntry(entry);
      setMessage("Registro BI guardado con exito.");
      setEntry(emptyBiEntry(profile, masters));
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar registro BI.");
    }
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Registro BI</h2>
          <p className="muted">Registra horas BI sin flujo de tickets ni aprobaciones.</p>
        </div>
        <div className="segmented">
          <button className={view === "registro" ? "active" : ""} type="button" onClick={() => setView("registro")}>Registrar BI</button>
          <button className={view === "listado" ? "active" : ""} type="button" onClick={() => setView("listado")}>Listado BI</button>
        </div>
      </div>

      {view === "registro" && (
        <form className="card grid register-card" onSubmit={submit}>
          <div className="section-head compact register-title">
            <div>
              <h3>Nuevo registro BI</h3>
              <p className="muted">El correlativo se generara automaticamente al guardar.</p>
            </div>
          </div>
          <div className="form-band">
            <h3>Datos generales</h3>
            <div className="grid grid-3">
              <label>
                Correlativo
                <input value={entry.correlativo || "Autogenerado"} disabled />
              </label>
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
          {message && <div className="notice">{message}</div>}
          <button><Save size={16} /> Guardar BI</button>
        </form>
      )}

      {view === "listado" && (
        <div className="card table-card">
          <label>
            Buscar
            <div className="input-with-icon">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Correlativo, recurso, servicio..." />
            </div>
          </label>
          <table>
            <thead>
              <tr>
                <th>Correlativo</th>
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
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((item) => (
                <tr key={item.id}>
                  <td>{item.correlativo}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEntries.length === 0 && <p className="muted">No hay registros BI.</p>}
        </div>
      )}
    </section>
  );
}
