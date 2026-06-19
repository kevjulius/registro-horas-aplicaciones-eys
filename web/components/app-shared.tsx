"use client";

import { useMemo } from "react";
import { Save, X } from "lucide-react";
import { ticketMatchesReportPeriod } from "@/lib/ticket-period";
import type { MasterData, Profile, Ticket, TicketAttentionType, TimeEntry } from "@/lib/types";

export const estados = ["En Proceso", "Cerrado", "Pendiente"] as const;
export const ticketEstados = ["En Proceso", "Cerrado"] as const;
export const ticketApprovalStatuses = ["Pendiente", "Aprobado", "Rechazado"] as const;
export const ticketAttentionTypes: TicketAttentionType[] = [
  "Requerimiento",
  "Proyecto",
  "Anteproyecto",
  "Soporte",
  "Monitoreo",
  "Incidencia",
  "Actividades Internas"
];
export const siNo = ["No", "Si"] as const;
export const hourValidationMessage = "El valor debe ser mayor a 0 y menor a 8.";

export function maxDaysForAttention(masters: MasterData, tipoAtencion: string) {
  return masters.attentionRules.find((rule) => rule.tipo_atencion === tipoAtencion)?.max_dias ?? null;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function showHourValidation(event: React.InvalidEvent<HTMLInputElement>) {
  event.currentTarget.setCustomValidity(hourValidationMessage);
}

export function clearHourValidation(event: React.FormEvent<HTMLInputElement>) {
  event.currentTarget.setCustomValidity("");
}

export function emptyEntry(profile: Profile | null): TimeEntry {
  return {
    id: crypto.randomUUID(),
    fecha_reporte: today(),
    codigo_tck: "",
    usuario_reporta: "",
    recurso: profile?.role === "trabajador" ? profile.resource_name ?? "" : "",
    aplicativo: "",
    fecha_inicio: today(),
    fecha_fin: today(),
    descripcion: "",
    sociedad: "",
    tipo_atencion: "",
    horas_invertidas: 0,
    estado_tck: "Cerrado",
    en_servicio: "No",
    aplicativo_se_encuentra: "Si",
    modificado: new Date().toISOString()
  };
}

export function emptyTicket(): Ticket {
  return {
    id: `new-${crypto.randomUUID()}`,
    codigo_tck: "",
    fecha_solicitud: today(),
    sistema: "",
    formato: "",
    usuario_solicitante: "",
    fecha_recepcion: today(),
    subject_correo: "",
    alcance_correo: "",
    tipo_atencion: "Requerimiento",
    subcategoria_atencion: "",
    estado: "En Proceso",
    fecha_termino: today(),
    tipo_tck: "Personal",
    en_servicio: "No",
    aplicativo_se_encuentra: "Si",
    approval_status: "Aprobado",
    rejection_reason: "",
    responsables: [],
    active: true
  };
}

export function ticketMatchesEntry(ticket: Ticket, entry: TimeEntry, profile: Profile) {
  if (ticket.codigo_tck.toUpperCase() !== entry.codigo_tck.trim().toUpperCase()) return false;
  if (!ticketMatchesReportPeriod(ticket, entry.fecha_reporte)) return false;
  if (["trabajador", "trabajador_aplicaciones"].includes(profile.role) && !ticket.responsables.includes(profile.resource_name ?? "")) return false;
  return true;
}

function ticketSearchLabels(tickets: Ticket[]) {
  return tickets
    .map((ticket) => ({
      value: ticket.codigo_tck,
      label: `${ticket.codigo_tck} - ${ticket.sistema} - ${ticket.subject_correo}`
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

export function TicketCodeField({
  label,
  value,
  tickets,
  onChange
}: {
  label: string;
  value: string;
  tickets: Ticket[];
  onChange: (value: string) => void;
}) {
  const listId = useMemo(() => `tickets-${crypto.randomUUID()}`, []);
  const options = useMemo(() => ticketSearchLabels(tickets), [tickets]);

  return (
    <label>
      {label}
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        placeholder="Escribe el codigo del ticket"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </datalist>
    </label>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecciona</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function splitSociedades(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinSociedades(values: string[]) {
  return values.join(" | ");
}

export function MultiSelectField({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selected = splitSociedades(value);

  function toggle(option: string) {
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    onChange(joinSociedades(next));
  }

  return (
    <label>
      {label}
      <div className="multi-select">
        {options.map((option) => (
          <button
            key={option}
            className={selected.includes(option) ? "active" : ""}
            type="button"
            disabled={disabled}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </label>
  );
}

export function TicketForm({
  ticket,
  masters,
  onPatch,
  onToggleResponsible,
  submitLabel,
  onSubmit,
  onClose,
  canEditApproval = false,
  responsibilitiesDisabled = false,
  showReceptionDate = true,
  resourceOptions,
  applicationOptions
}: {
  ticket: Ticket;
  masters: MasterData;
  onPatch: (values: Partial<Ticket>) => void;
  onToggleResponsible: (resource: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  onClose?: () => void;
  canEditApproval?: boolean;
  responsibilitiesDisabled?: boolean;
  showReceptionDate?: boolean;
  resourceOptions?: string[];
  applicationOptions?: string[];
}) {
  const responsibleOptions = resourceOptions ?? masters.recursos;
  const systemOptions = applicationOptions ?? masters.aplicaciones;
  const attentionDetails = masters.tiposAtencionDetalle.length
    ? masters.tiposAtencionDetalle
    : masters.tiposAtencion.map((name) => {
        const [type, ...classification] = name.split(" - ");
        return { name, type: type.trim(), classification: classification.join(" - ").trim() };
      });
  const attentionTypes = Array.from(new Set(attentionDetails.map((item) => item.type).filter(Boolean))) as TicketAttentionType[];
  const subcategories = attentionDetails
    .filter((item) => item.type === ticket.tipo_atencion)
    .map((item) => item.classification)
    .filter(Boolean);

  return (
    <div className="card grid ticket-form-card">
      <div className="section-head compact">
        <div>
          <h3>{ticket.codigo_tck || "Nuevo ticket"}</h3>
          <p className="muted">{ticket.codigo_tck ? "Edita los datos del ticket." : "El codigo se generara automaticamente al guardar."}</p>
        </div>
        {onClose && (
          <button className="secondary icon-button" type="button" onClick={onClose} title="Cerrar edicion">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="form-band">
        <h3>Datos principales</h3>
        <div className="grid grid-4">
          <label>
            Tipo de atencion
            <select value={ticket.tipo_atencion} onChange={(event) => onPatch({ tipo_atencion: event.target.value as Ticket["tipo_atencion"], subcategoria_atencion: "" })}>
              {(attentionTypes.length ? attentionTypes : ticketAttentionTypes).map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <SelectField label="Subcategoria" value={ticket.subcategoria_atencion} options={subcategories} onChange={(value) => onPatch({ subcategoria_atencion: value })} />
          <label>
            Estado
            <select value={ticket.estado} onChange={(event) => onPatch({ estado: event.target.value as Ticket["estado"] })}>
              {ticketEstados.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
          <label>
            Tipo de ticket
            <input value={ticket.tipo_tck} disabled />
          </label>
        </div>
      </div>

      <div className="form-band">
        <h3>Fechas y solicitante</h3>
        <div className="grid grid-4">
          <label>
            Fecha inicio
            <input type="date" value={ticket.fecha_solicitud} onChange={(event) => onPatch({ fecha_solicitud: event.target.value })} />
          </label>
          {showReceptionDate && (
            <label>
              Fecha recepcion
              <input type="date" value={ticket.fecha_recepcion} onChange={(event) => onPatch({ fecha_recepcion: event.target.value })} />
            </label>
          )}
          <label>
            Fecha termino
            <input type="date" value={ticket.fecha_termino} onChange={(event) => onPatch({ fecha_termino: event.target.value })} />
          </label>
          <SelectField label="Usuario solicitante" value={ticket.usuario_solicitante} options={masters.usuariosReporta} onChange={(value) => onPatch({ usuario_solicitante: value })} />
        </div>
      </div>

      <div className="form-band">
        <h3>Clasificacion y responsables</h3>
        {systemOptions.length === 0 && (
          <div className="notice inline-notice">Tu equipo no tiene sistemas asignados. Solicita a administracion configurar los sistemas visibles del equipo.</div>
        )}
        <div className="ticket-form-grid">
          <SelectField label="Sistema" value={ticket.sistema} options={systemOptions} onChange={(value) => onPatch({ sistema: value })} />
          <SelectField label="Aplicativo se encuentra operativo" value={ticket.aplicativo_se_encuentra} options={siNo} onChange={(value) => onPatch({ aplicativo_se_encuentra: value as "Si" | "No" })} />
          <SelectField label="Es un servicio de integracion?" value={ticket.en_servicio} options={siNo} onChange={(value) => onPatch({ en_servicio: value as "Si" | "No" })} />
          <MultiSelectField label="Formato" value={ticket.formato} options={masters.sociedades} onChange={(value) => onPatch({ formato: value })} />
          <label>
            Responsables
            <div className="multi-select team-select">
              {responsibleOptions.map((resource) => (
                <button
                  key={resource}
                  type="button"
                  className={ticket.responsables.includes(resource) ? "active" : ""}
                  disabled={responsibilitiesDisabled}
                  onClick={() => onToggleResponsible(resource)}
                >
                  {resource}
                </button>
              ))}
            </div>
          </label>
        </div>
      </div>

      <div className="form-band">
        <h3>Detalle</h3>
        <label>
          Alcance de la Atencion
          <textarea
            value={ticket.alcance_correo}
            onChange={(event) => onPatch({ alcance_correo: event.target.value, subject_correo: event.target.value })}
            placeholder="Describe el alcance de la atencion..."
          />
        </label>
      </div>

      <button type="button" onClick={onSubmit}><Save size={16} /> {submitLabel}</button>
    </div>
  );
}
