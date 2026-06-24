"use client";

import { useCallback, useMemo, useState } from "react";
import { Clock, Pencil, Save, Search, Trash2 } from "lucide-react";
import {
  clearHourValidation,
  emptyTicket,
  hourValidationMessage,
  LoadingOverlay,
  maxDaysForAttention,
  SelectField,
  ticketAttentionTypes,
  ticketEstados,
  TicketForm,
  today,
  showHourValidation,
  useAutoDismissNotice
} from "@/components/app-shared";
import { closeExpiredTickets, requestTicket, saveEntry, saveTickets } from "@/lib/repository";
import { ticketMatchesReportPeriod } from "@/lib/ticket-period";
import type { MasterData, Profile, Ticket, TimeEntry } from "@/lib/types";

export function TicketsView({
  profile,
  masters,
  tickets,
  visibleResources,
  visibleApplications,
  onChanged
}: {
  profile: Profile;
  masters: MasterData;
  tickets: Ticket[];
  visibleResources: string[];
  visibleApplications: string[];
  onChanged: () => void;
}) {
  const isAdmin = profile.role === "administracion";
  const responsibleOptions = isAdmin ? masters.recursos : visibleResources;

  function newDraftTicket(): Ticket {
    const draft = emptyTicket();
    return {
      ...draft,
      approval_status: "Aprobado",
      responsables: isAdmin ? [] : [profile.resource_name ?? responsibleOptions[0] ?? ""].filter(Boolean),
      tipo_tck: "Personal" as const
    };
  }

  const [draftTicket, setDraftTicket] = useState<Ticket>(() => newDraftTicket());
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketView, setTicketView] = useState<"crear" | "listado">("listado");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketMessageType, setTicketMessageType] = useState<"success" | "error">("success");
  const [isBusy, setIsBusy] = useState(false);
  const [quickTicket, setQuickTicket] = useState<Ticket | null>(null);
  const [quickDate, setQuickDate] = useState(today());
  const [quickHours, setQuickHours] = useState(0);
  const [quickDescription, setQuickDescription] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [quickMessageType, setQuickMessageType] = useState<"success" | "error">("success");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("Todos");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("Todos");
  const [ticketResponsibleFilter, setTicketResponsibleFilter] = useState(profile.resource_name ?? "Todos");
  const [ticketDateFrom, setTicketDateFrom] = useState("");
  const [ticketDateTo, setTicketDateTo] = useState("");

  const clearTicketMessage = useCallback(() => setTicketMessage(""), []);
  const clearQuickMessage = useCallback(() => setQuickMessage(""), []);
  useAutoDismissNotice(ticketMessage, clearTicketMessage);
  useAutoDismissNotice(quickMessage, clearQuickMessage);

  function notifyTicket(text: string, type: "success" | "error") {
    setTicketMessage(text);
    setTicketMessageType(type);
  }

  function notifyQuick(text: string, type: "success" | "error") {
    setQuickMessage(text);
    setQuickMessageType(type);
  }

  const filteredTickets = useMemo(() => {
    const search = ticketSearch.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (!isAdmin && !ticket.responsables.includes(profile.resource_name ?? "")) return false;
      if (ticketDateFrom && ticket.fecha_solicitud < ticketDateFrom) return false;
      if (ticketDateTo && ticket.fecha_solicitud > ticketDateTo) return false;
      if (ticketStatusFilter !== "Todos" && ticket.estado !== ticketStatusFilter) return false;
      if (ticketTypeFilter !== "Todos" && ticket.tipo_atencion !== ticketTypeFilter) return false;
      if (ticketResponsibleFilter !== "Todos" && !ticket.responsables.includes(ticketResponsibleFilter)) return false;
      if (search) {
        const haystack = [
          ticket.codigo_tck,
          ticket.sistema,
          ticket.usuario_solicitante,
          ticket.alcance_correo,
          ticket.subcategoria_atencion,
          ticket.responsables.join(" ")
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [isAdmin, profile.resource_name, tickets, ticketDateFrom, ticketDateTo, ticketResponsibleFilter, ticketSearch, ticketStatusFilter, ticketTypeFilter]);

  function clearTicketFilters() {
    setTicketSearch("");
    setTicketStatusFilter("Todos");
    setTicketTypeFilter("Todos");
    setTicketResponsibleFilter(profile.resource_name ?? "Todos");
    setTicketDateFrom("");
    setTicketDateTo("");
  }

  function normalizeTicket(values: Ticket): Ticket {
    const automaticState = values.fecha_termino < today()
      ? "Cerrado"
      : values.estado === "Cerrado"
        ? "Cerrado"
        : "En Proceso";
    return {
      ...values,
      estado: automaticState,
      approval_status: "Aprobado",
      rejection_reason: "",
      tipo_tck: values.responsables.length > 1 ? "Grupal" : "Personal"
    };
  }

  function patchDraft(values: Partial<Ticket>) {
    setDraftTicket((current) => normalizeTicket({ ...current, ...values }));
  }

  function patchEditing(values: Partial<Ticket>) {
    setEditingTicket((current) => current ? normalizeTicket({ ...current, ...values }) : current);
  }

  function toggleTicketResponsible(ticket: Ticket, resource: string, setter: (values: Partial<Ticket>) => void) {
    const responsables = ticket.responsables.includes(resource)
      ? ticket.responsables.filter((item) => item !== resource)
      : [...ticket.responsables, resource];
    setter({ responsables });
  }

  function validateTicketForm(ticket: Ticket) {
    const required = [
      ticket.fecha_solicitud,
      ticket.sistema,
      ticket.formato,
      ticket.usuario_solicitante,
      ticket.fecha_recepcion,
      ticket.alcance_correo,
      ticket.tipo_atencion,
      ticket.subcategoria_atencion,
      ticket.estado,
      ticket.fecha_termino,
      ticket.tipo_tck,
      ticket.en_servicio,
      ticket.aplicativo_se_encuentra
    ];
    if (required.some((value) => !String(value ?? "").trim())) return "Todos los campos del ticket son obligatorios.";
    if (ticket.fecha_termino < ticket.fecha_solicitud) return "La fecha termino no puede ser anterior a la fecha inicio.";
    if (ticket.fecha_termino < today() && ticket.estado !== "Cerrado") return "Si la fecha termino es anterior a hoy, el estado debe ser Cerrado.";
    if (ticket.fecha_termino >= today() && !["Cerrado", "En Proceso"].includes(ticket.estado)) return "Si la fecha termino es hoy o futura, el estado debe ser Cerrado o En Proceso.";
    const maxDays = maxDaysForAttention(masters, ticket.tipo_atencion);
    if (maxDays) {
      const start = new Date(`${ticket.fecha_solicitud}T00:00:00`);
      const end = new Date(`${ticket.fecha_termino}T00:00:00`);
      const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
      if (days > maxDays) return `El tipo de atencion "${ticket.tipo_atencion}" permite maximo ${maxDays} dias.`;
    }
    if (!isAdmin && ticket.responsables.some((resource) => !responsibleOptions.includes(resource))) {
      return "Solo puedes asignar recursos de tus equipos.";
    }
    if (!isAdmin && !visibleApplications.includes(ticket.sistema)) {
      return "Solo puedes crear tickets para sistemas asignados a tus equipos.";
    }
    if (ticket.tipo_tck === "Personal" && ticket.responsables.length !== 1) return "Un ticket Personal debe tener exactamente un responsable.";
    if (ticket.tipo_tck === "Grupal" && ticket.responsables.length < 2) return "Un ticket Grupal debe tener dos o mas responsables.";
    return "";
  }

  async function persistTicket(ticket: Ticket, successMessage: string) {
    const ticketToSave = ticket.id.startsWith("new-")
      ? { ...ticket, fecha_recepcion: today() }
      : ticket;
    const validation = validateTicketForm(ticketToSave);
    if (validation) {
      notifyTicket(validation, "error");
      return;
    }
    try {
      setIsBusy(true);
      const normalizedTicket = { ...ticketToSave, subject_correo: ticketToSave.alcance_correo };
      let generatedCode = normalizedTicket.codigo_tck;
      if (isAdmin) {
        const previousCodes = new Set(tickets.map((item) => item.codigo_tck));
        const savedTickets = await saveTickets([normalizedTicket]);
        const createdTicket = savedTickets.find((item) => {
          return !previousCodes.has(item.codigo_tck)
            && item.sistema === normalizedTicket.sistema
            && item.fecha_solicitud === normalizedTicket.fecha_solicitud
            && item.fecha_termino === normalizedTicket.fecha_termino
            && item.alcance_correo === normalizedTicket.alcance_correo;
        });
        generatedCode = generatedCode || createdTicket?.codigo_tck || "";
      }
      else {
        const result = await requestTicket({ ...normalizedTicket, approval_status: "Aprobado", rejection_reason: "", tipo_tck: ticket.responsables.length > 1 ? "Grupal" : "Personal" });
        generatedCode = result.ticketCode ?? generatedCode;
      }
      notifyTicket(generatedCode ? `${successMessage} Codigo generado: ${generatedCode}.` : successMessage, "success");
      setDraftTicket(newDraftTicket());
      setEditingTicket(null);
      setTicketView("listado");
      onChanged();
    } catch (error) {
      notifyTicket(error instanceof Error ? error.message : "No se pudo guardar tickets.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteTicket(ticket: Ticket) {
    try {
      setIsBusy(true);
      await saveTickets([{ ...ticket, active: false }]);
      notifyTicket("Ticket eliminado.", "success");
      if (editingTicket?.id === ticket.id) setEditingTicket(null);
      onChanged();
    } catch (error) {
      notifyTicket(error instanceof Error ? error.message : "No se pudo eliminar ticket.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  function openQuickEntry(ticket: Ticket) {
    setQuickTicket(ticket);
    setQuickDate(ticket.fecha_solicitud <= today() && today() <= ticket.fecha_termino ? today() : ticket.fecha_solicitud);
    setQuickHours(0);
    setQuickDescription("");
    setQuickMessage("");
    setTicketSearch(ticket.codigo_tck);
    setTicketStatusFilter("Todos");
    setTicketTypeFilter("Todos");
    setTicketResponsibleFilter("Todos");
    setTicketDateFrom("");
    setTicketDateTo("");
  }

  async function saveQuickEntry() {
    if (!quickTicket) return;
    if (!profile.resource_name) {
      notifyQuick("Tu usuario no tiene recurso asignado.", "error");
      return;
    }
    if (!quickTicket.responsables.includes(profile.resource_name)) {
      notifyQuick("Solo puedes registrar horas en tickets asignados a tu usuario.", "error");
      return;
    }
    if (!ticketMatchesReportPeriod(quickTicket, quickDate)) {
      notifyQuick(`El rango de fecha del ticket es de ${quickTicket.fecha_solicitud} al ${quickTicket.fecha_termino}. En caso requiera extender la fecha fin, contactarse con el administrador.`, "error");
      return;
    }
    if (quickHours <= 0 || quickHours > 8) {
      notifyQuick(hourValidationMessage, "error");
      return;
    }

    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      fecha_reporte: quickDate,
      codigo_tck: quickTicket.codigo_tck,
      usuario_reporta: quickTicket.usuario_solicitante,
      recurso: profile.resource_name,
      aplicativo: quickTicket.sistema,
      fecha_inicio: quickTicket.fecha_solicitud,
      fecha_fin: quickTicket.fecha_termino,
      descripcion: quickDescription.trim(),
      sociedad: quickTicket.formato,
      tipo_atencion: `${quickTicket.tipo_atencion} - ${quickTicket.subcategoria_atencion}`,
      horas_invertidas: quickHours,
      estado_tck: quickTicket.estado === "Cancelado" ? "Pendiente" : quickTicket.estado,
      en_servicio: quickTicket.en_servicio,
      aplicativo_se_encuentra: quickTicket.aplicativo_se_encuentra,
      modificado: new Date().toISOString()
    };

    try {
      setIsBusy(true);
      await saveEntry(entry);
      notifyTicket("Horas registradas con exito.", "success");
      setQuickMessage("");
      setQuickHours(0);
      setQuickDescription("");
      setQuickTicket(null);
      onChanged();
    } catch (error) {
      notifyQuick(error instanceof Error ? error.message : "No se pudo registrar horas.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  async function closeExpired() {
    try {
      setIsBusy(true);
      const result = await closeExpiredTickets();
      notifyTicket(`Tickets vencidos cerrados: ${result.updated}.`, "success");
      onChanged();
    } catch (error) {
      notifyTicket(error instanceof Error ? error.message : "No se pudo cerrar tickets vencidos.", "error");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="grid">
      <LoadingOverlay show={isBusy} />
      <div className="section-head">
        <div>
          <h2>Tickets</h2>
          <p className="muted">Gestiona tickets y registra horas directamente desde cada ticket.</p>
        </div>
        {isAdmin && <button className="secondary" type="button" disabled={isBusy} onClick={closeExpired}>Cerrar tickets vencidos</button>}
      </div>

      <div className="segmented">
        <button className={ticketView === "crear" ? "active" : ""} type="button" disabled={isBusy} onClick={() => { setTicketMessage(""); setDraftTicket(newDraftTicket()); setTicketView("crear"); }}>
          Crear ticket
        </button>
        <button className={ticketView === "listado" ? "active" : ""} type="button" disabled={isBusy} onClick={() => { setTicketMessage(""); setTicketView("listado"); }}>Listado de tickets</button>
      </div>

      {ticketMessage && <pre className={`notice ${ticketMessageType}`}>{ticketMessage}</pre>}

      {ticketView === "crear" && (
        <TicketForm
          ticket={draftTicket}
          masters={masters}
          onPatch={patchDraft}
          onToggleResponsible={(resource) => toggleTicketResponsible(draftTicket, resource, patchDraft)}
          submitLabel="Crear ticket"
          onSubmit={() => persistTicket(draftTicket, "Ticket creado.")}
          showReceptionDate={false}
          resourceOptions={responsibleOptions}
          applicationOptions={visibleApplications}
          disabled={isBusy}
        />
      )}

      {ticketView === "listado" && (
        <div className="grid">
          <div className="card grid">
            <div className="grid grid-6 filters">
              <label>
                Buscar
                <div className="input-with-icon">
                  <Search size={16} />
                  <input value={ticketSearch} onChange={(event) => setTicketSearch(event.target.value)} placeholder="Codigo, asunto, sistema..." />
                </div>
              </label>
              <SelectField label="Estado" value={ticketStatusFilter} options={["Todos", ...ticketEstados]} onChange={setTicketStatusFilter} />
              <SelectField label="Tipo" value={ticketTypeFilter} options={["Todos", ...ticketAttentionTypes]} onChange={setTicketTypeFilter} />
              <SelectField label="Responsable" value={ticketResponsibleFilter} options={["Todos", ...responsibleOptions]} onChange={setTicketResponsibleFilter} />
              <label>
                Desde inicio
                <input type="date" value={ticketDateFrom} onChange={(event) => setTicketDateFrom(event.target.value)} />
              </label>
              <label>
                Hasta inicio
                <input type="date" value={ticketDateTo} onChange={(event) => setTicketDateTo(event.target.value)} />
              </label>
            </div>
            <button className="secondary" type="button" disabled={isBusy} onClick={clearTicketFilters}>Limpiar filtros</button>
          </div>

          {editingTicket && isAdmin && (
            <TicketForm
              ticket={editingTicket}
              masters={masters}
              onPatch={patchEditing}
              onToggleResponsible={(resource) => toggleTicketResponsible(editingTicket, resource, patchEditing)}
              submitLabel="Guardar ticket"
              onSubmit={() => persistTicket(editingTicket, "Ticket actualizado.")}
              onClose={() => setEditingTicket(null)}
              showReceptionDate
              resourceOptions={responsibleOptions}
              applicationOptions={visibleApplications}
              disabled={isBusy}
            />
          )}

          {quickTicket && (
            <div className="card grid quick-hours-card">
              <div className="section-head compact">
                <div>
                  <h3>Registrar horas en {quickTicket.codigo_tck}</h3>
                  <p className="muted">{quickTicket.sistema} · {quickTicket.fecha_solicitud} a {quickTicket.fecha_termino}</p>
                </div>
                <button className="secondary" type="button" disabled={isBusy} onClick={() => setQuickTicket(null)}>Cerrar</button>
              </div>
              <div className="grid grid-3">
                <label>
                  Fecha reporte
                  <input type="date" value={quickDate} onChange={(event) => setQuickDate(event.target.value)} />
                </label>
                <label>
                  Horas
                  <input
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={quickHours}
                    onInvalid={showHourValidation}
                    onInput={clearHourValidation}
                    onChange={(event) => setQuickHours(Number(event.target.value))}
                  />
                </label>
                <button type="button" disabled={isBusy} onClick={saveQuickEntry}><Save size={16} /> Guardar horas</button>
              </div>
              <label>
                Descripcion
                <textarea value={quickDescription} onChange={(event) => setQuickDescription(event.target.value)} placeholder="Detalle de las horas registradas..." />
              </label>
              {quickMessage && <div className={`notice ${quickMessageType}`}>{quickMessage}</div>}
            </div>
          )}

          <div className="card table-card tickets-table">
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Inicio</th>
                  <th>Termino</th>
                  <th>Sistema</th>
                  <th>Formato</th>
                  <th>Solicitante</th>
                  <th>Tipo</th>
                  <th>Subcategoria</th>
                  <th>Estado</th>
                  <th>Responsables</th>
                  <th>Detalle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.codigo_tck}</td>
                    <td>{ticket.fecha_solicitud}</td>
                    <td>{ticket.fecha_termino}</td>
                    <td>{ticket.sistema}</td>
                    <td className="description-cell">{ticket.formato}</td>
                    <td>{ticket.usuario_solicitante}</td>
                    <td>{ticket.tipo_atencion}</td>
                    <td>{ticket.subcategoria_atencion}</td>
                    <td><span className={`status ${ticket.estado === "Cerrado" ? "closed" : "progress"}`}>{ticket.estado}</span></td>
                    <td className="description-cell">{ticket.responsables.join("; ")}</td>
                    <td className="description-cell">{ticket.alcance_correo}</td>
                    <td>
                      <div className="row-actions">
                        <button className="secondary icon-button" type="button" disabled={isBusy} title="Registrar horas" onClick={() => openQuickEntry(ticket)}>
                          <Clock size={16} />
                        </button>
                        {isAdmin && (
                          <>
                            <button className="secondary icon-button" type="button" disabled={isBusy} title="Editar ticket" onClick={() => { setEditingTicket(ticket); setTicketMessage(""); }}>
                              <Pencil size={16} />
                            </button>
                            <button className="secondary icon-button" type="button" disabled={isBusy} title="Eliminar ticket" onClick={() => deleteTicket(ticket)}>
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTickets.length === 0 && <p className="muted">No hay tickets con esos filtros.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
