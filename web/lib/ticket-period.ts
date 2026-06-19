import type { Ticket } from "./types";

function isIsoDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function ticketMatchesReportPeriod(ticket: Pick<Ticket, "fecha_solicitud" | "fecha_termino">, reportDate: string) {
  if (!isIsoDate(ticket.fecha_solicitud) || !isIsoDate(ticket.fecha_termino) || !isIsoDate(reportDate)) return false;
  return reportDate >= ticket.fecha_solicitud && reportDate <= ticket.fecha_termino;
}

export function ticketPeriodValidationMessage(ticket: Pick<Ticket, "codigo_tck" | "fecha_solicitud" | "fecha_termino">, reportDate: string) {
  if (ticketMatchesReportPeriod(ticket, reportDate)) return "";
  return `El ticket ${ticket.codigo_tck} solo permite reportes entre ${ticket.fecha_solicitud} y ${ticket.fecha_termino}.`;
}
