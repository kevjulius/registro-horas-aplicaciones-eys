"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
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
  ticketMatchesEntry
} from "@/components/app-shared";
import { saveEntry } from "@/lib/repository";
import { ticketPeriodValidationMessage } from "@/lib/ticket-period";
import type { MasterData, Profile, Ticket, TimeEntry } from "@/lib/types";

export function RegisterView({ profile, masters, tickets, onSaved }: { profile: Profile; masters: MasterData; tickets: Ticket[]; onSaved: () => void }) {
  const [entry, setEntry] = useState<TimeEntry>(() => emptyEntry(profile));
  const [saveMessage, setSaveMessage] = useState("");
  const approvedTickets = useMemo(() => tickets.filter((ticket) => ticket.approval_status === "Aprobado"), [tickets]);

  function patch(values: Partial<TimeEntry>) {
    setEntry((current) => ({ ...current, ...values }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!entry.codigo_tck || !entry.sociedad || !entry.horas_invertidas) {
      setSaveMessage("Completa TCK, sociedad y horas antes de guardar.");
      return;
    }
    const selectedTicket = approvedTickets.find((ticket) => ticket.codigo_tck.toUpperCase() === entry.codigo_tck.trim().toUpperCase());
    if (selectedTicket) {
      const periodMessage = ticketPeriodValidationMessage(selectedTicket, entry.fecha_reporte);
      if (periodMessage) {
        setSaveMessage(periodMessage);
        return;
      }
    }
    if (!approvedTickets.some((ticket) => ticketMatchesEntry(ticket, entry, profile))) {
      setSaveMessage("Selecciona un ticket existente, aprobado y asignado a tu usuario.");
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
          <TicketCodeField label="Codigo TCK" value={entry.codigo_tck} tickets={approvedTickets} onChange={(value) => patch({ codigo_tck: value })} />
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
          <SelectField label="Es un servicio de integracion?" value={entry.en_servicio} options={siNo} onChange={(v) => patch({ en_servicio: v as "Si" | "No" })} />
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
