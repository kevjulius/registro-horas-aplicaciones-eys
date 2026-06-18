"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Search, Trash2, XCircle } from "lucide-react";
import {
  emptyTicket,
  SelectField,
  ticketApprovalStatuses,
  ticketAttentionTypes,
  ticketEstados,
  TicketForm,
  today
} from "@/components/app-shared";
import { requestTicket, saveTickets } from "@/lib/repository";
import type { MasterData, Profile, Ticket } from "@/lib/types";

export function TicketsView({
  profile,
  masters,
  tickets,
  visibleResources,
  onChanged
}: {
  profile: Profile;
  masters: MasterData;
  tickets: Ticket[];
  visibleResources: string[];
  onChanged: () => void;
}) {
  const isAdmin = profile.role === "administracion";
  const responsibleOptions = isAdmin ? masters.recursos : visibleResources;

  function newDraftTicket(): Ticket {
    const draft = emptyTicket();
    return {
      ...draft,
      approval_status: isAdmin ? "Aprobado" : "Pendiente",
      responsables: isAdmin ? [] : [profile.resource_name ?? responsibleOptions[0] ?? ""].filter(Boolean),
      tipo_tck: "Personal" as const
    };
  }

  const [draftTicket, setDraftTicket] = useState<Ticket>(() => newDraftTicket());
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [ticketView, setTicketView] = useState<"crear" | "listado">("listado");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("Todos");
  const [ticketApprovalFilter, setTicketApprovalFilter] = useState("Todos");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("Todos");
  const [ticketResponsibleFilter, setTicketResponsibleFilter] = useState("Todos");
  const [ticketDateFrom, setTicketDateFrom] = useState(today());
  const [ticketDateTo, setTicketDateTo] = useState(today());

  const filteredTickets = useMemo(() => {
    const search = ticketSearch.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (!isAdmin && !ticket.responsables.includes(profile.resource_name ?? "")) return false;
      if (ticketDateFrom && ticket.fecha_recepcion < ticketDateFrom) return false;
      if (ticketDateTo && ticket.fecha_recepcion > ticketDateTo) return false;
      if (ticketStatusFilter !== "Todos" && ticket.estado !== ticketStatusFilter) return false;
      if (ticketApprovalFilter !== "Todos" && ticket.approval_status !== ticketApprovalFilter) return false;
      if (ticketTypeFilter !== "Todos" && ticket.tipo_atencion !== ticketTypeFilter) return false;
      if (ticketResponsibleFilter !== "Todos" && !ticket.responsables.includes(ticketResponsibleFilter)) return false;
      if (search) {
        const haystack = [
          ticket.codigo_tck,
          ticket.sistema,
          ticket.usuario_solicitante,
          ticket.alcance_correo,
          ticket.approval_status,
          ticket.rejection_reason,
          ticket.responsables.join(" ")
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [isAdmin, profile.resource_name, tickets, ticketApprovalFilter, ticketDateFrom, ticketDateTo, ticketResponsibleFilter, ticketSearch, ticketStatusFilter, ticketTypeFilter]);

  function clearTicketFilters() {
    setTicketSearch("");
    setTicketStatusFilter("Todos");
    setTicketApprovalFilter("Todos");
    setTicketTypeFilter("Todos");
    setTicketResponsibleFilter("Todos");
    setTicketDateFrom(today());
    setTicketDateTo(today());
  }

  function normalizeTicket(values: Ticket): Ticket {
    return {
      ...values,
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
      ticket.estado,
      ticket.fecha_termino,
      ticket.tipo_tck
    ];
    if (required.some((value) => !String(value ?? "").trim())) return "Todos los campos del ticket son obligatorios.";
    if (ticket.approval_status === "Rechazado" && !ticket.rejection_reason.trim()) return "El motivo de rechazo es obligatorio.";
    if (!isAdmin && ticket.responsables.some((resource) => !responsibleOptions.includes(resource))) {
      return "Solo puedes asignar recursos de tus equipos.";
    }
    if (ticket.tipo_tck === "Personal" && ticket.responsables.length !== 1) return "Un ticket Personal debe tener exactamente un responsable.";
    if (ticket.tipo_tck === "Grupal" && ticket.responsables.length < 2) return "Un ticket Grupal debe tener dos o mas responsables.";
    return "";
  }

  async function persistTicket(ticket: Ticket, successMessage: string) {
    const validation = validateTicketForm(ticket);
    if (validation) {
      setTicketMessage(validation);
      return;
    }
    try {
      const normalizedTicket = { ...ticket, subject_correo: ticket.alcance_correo };
      if (isAdmin) await saveTickets([normalizedTicket]);
      else await requestTicket({ ...normalizedTicket, approval_status: "Pendiente", rejection_reason: "", tipo_tck: ticket.responsables.length > 1 ? "Grupal" : "Personal" });
      setTicketMessage(successMessage);
      setDraftTicket(newDraftTicket());
      setEditingTicket(null);
      setTicketView("listado");
      onChanged();
    } catch (error) {
      setTicketMessage(error instanceof Error ? error.message : "No se pudo guardar tickets.");
    }
  }

  async function deleteTicket(ticket: Ticket) {
    try {
      await saveTickets([{ ...ticket, active: false }]);
      setTicketMessage("Ticket eliminado.");
      if (editingTicket?.id === ticket.id) setEditingTicket(null);
      onChanged();
    } catch (error) {
      setTicketMessage(error instanceof Error ? error.message : "No se pudo eliminar ticket.");
    }
  }

  async function reviewTicket(ticket: Ticket, approvalStatus: "Aprobado" | "Rechazado") {
    const rejectionReason = approvalStatus === "Rechazado"
      ? window.prompt("Motivo de rechazo")?.trim() ?? ""
      : "";
    if (approvalStatus === "Rechazado" && !rejectionReason) {
      setTicketMessage("El motivo de rechazo es obligatorio.");
      return;
    }

    try {
      await saveTickets([{ ...ticket, approval_status: approvalStatus, rejection_reason: rejectionReason }]);
      setTicketMessage(approvalStatus === "Aprobado" ? "Ticket aprobado." : "Ticket rechazado.");
      onChanged();
    } catch (error) {
      setTicketMessage(error instanceof Error ? error.message : "No se pudo revisar ticket.");
    }
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Tickets</h2>
          <p className="muted">{isAdmin ? "Gestiona tickets, responsables y aprobaciones." : "Solicita tickets y consulta el estado de aprobacion."}</p>
        </div>
      </div>

      <div className="segmented">
        <button className={ticketView === "crear" ? "active" : ""} type="button" onClick={() => { setTicketMessage(""); setDraftTicket(newDraftTicket()); setTicketView("crear"); }}>
          {isAdmin ? "Crear ticket" : "Solicitar ticket"}
        </button>
        <button className={ticketView === "listado" ? "active" : ""} type="button" onClick={() => { setTicketMessage(""); setTicketView("listado"); }}>Listado de tickets</button>
      </div>

      {ticketMessage && <pre className="notice">{ticketMessage}</pre>}

      {ticketView === "crear" && (
        <TicketForm
          ticket={draftTicket}
          masters={masters}
          onPatch={patchDraft}
          onToggleResponsible={(resource) => toggleTicketResponsible(draftTicket, resource, patchDraft)}
          submitLabel={isAdmin ? "Crear ticket" : "Enviar solicitud"}
          onSubmit={() => persistTicket(draftTicket, isAdmin ? "Ticket creado." : "Solicitud enviada para aprobacion.")}
          canEditApproval={isAdmin}
          resourceOptions={responsibleOptions}
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
              <SelectField label="Aprobacion" value={ticketApprovalFilter} options={["Todos", ...ticketApprovalStatuses]} onChange={setTicketApprovalFilter} />
              <SelectField label="Tipo" value={ticketTypeFilter} options={["Todos", ...ticketAttentionTypes]} onChange={setTicketTypeFilter} />
              <SelectField label="Responsable" value={ticketResponsibleFilter} options={["Todos", ...responsibleOptions]} onChange={setTicketResponsibleFilter} />
              <label>
                Desde recepcion
                <input type="date" value={ticketDateFrom} onChange={(event) => setTicketDateFrom(event.target.value)} />
              </label>
              <label>
                Hasta recepcion
                <input type="date" value={ticketDateTo} onChange={(event) => setTicketDateTo(event.target.value)} />
              </label>
            </div>
            <button className="secondary" type="button" onClick={clearTicketFilters}>Limpiar filtros</button>
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
              canEditApproval
              resourceOptions={responsibleOptions}
            />
          )}

          <div className="card table-card tickets-table">
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Recepcion</th>
                  <th>Termino</th>
                  <th>Sistema</th>
                  <th>Formato</th>
                  <th>Solicitante</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Aprobacion</th>
                  <th>Motivo de Rechazo</th>
                  <th>Responsables</th>
                  <th>Detalle</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.codigo_tck}</td>
                    <td>{ticket.fecha_recepcion}</td>
                    <td>{ticket.fecha_termino}</td>
                    <td>{ticket.sistema}</td>
                    <td className="description-cell">{ticket.formato}</td>
                    <td>{ticket.usuario_solicitante}</td>
                    <td>{ticket.tipo_atencion}</td>
                    <td><span className={`status ${ticket.estado === "Cerrado" ? "closed" : "progress"}`}>{ticket.estado}</span></td>
                    <td>
                      <span className={`status ${ticket.approval_status === "Aprobado" ? "closed" : "progress"}`}>
                        {ticket.approval_status}
                      </span>
                    </td>
                    <td className="description-cell">{ticket.approval_status === "Rechazado" ? ticket.rejection_reason : ""}</td>
                    <td className="description-cell">{ticket.responsables.join("; ")}</td>
                    <td className="description-cell">{ticket.alcance_correo}</td>
                    {isAdmin && (
                      <td>
                        <div className="row-actions">
                          <button className="secondary icon-button" type="button" title="Editar ticket" onClick={() => { setEditingTicket(ticket); setTicketMessage(""); }}>
                            <Pencil size={16} />
                          </button>
                          {ticket.approval_status === "Pendiente" && (
                            <>
                              <button className="secondary icon-button" type="button" title="Aprobar ticket" onClick={() => reviewTicket(ticket, "Aprobado")}>
                                <Check size={16} />
                              </button>
                              <button className="secondary icon-button" type="button" title="Rechazar ticket" onClick={() => reviewTicket(ticket, "Rechazado")}>
                                <XCircle size={16} />
                              </button>
                            </>
                          )}
                          <button className="secondary icon-button" type="button" title="Eliminar ticket" onClick={() => deleteTicket(ticket)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
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
