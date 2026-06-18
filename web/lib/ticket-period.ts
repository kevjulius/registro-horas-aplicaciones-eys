import type { Ticket } from "./types";

function periodKey(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : "";
}

export function ticketMatchesReportPeriod(ticket: Pick<Ticket, "fecha_recepcion">, reportDate: string) {
  const ticketPeriod = periodKey(ticket.fecha_recepcion);
  const reportPeriod = periodKey(reportDate);
  return Boolean(ticketPeriod && reportPeriod && ticketPeriod === reportPeriod);
}

export function ticketPeriodValidationMessage(ticket: Pick<Ticket, "codigo_tck" | "fecha_recepcion">, reportDate: string) {
  if (ticketMatchesReportPeriod(ticket, reportDate)) return "";
  return `El ticket ${ticket.codigo_tck} pertenece al periodo ${ticket.fecha_recepcion.slice(0, 7)} y no puede usarse con fecha de reporte ${reportDate}.`;
}
