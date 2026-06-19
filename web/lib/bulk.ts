import type { MasterData, Profile, Ticket, TimeEntry } from "./types";
import { ticketPeriodValidationMessage, ticketMatchesReportPeriod } from "./ticket-period";

export const bulkHeaders = [
  "fecha_reporte",
  "codigo_tck",
  "descripcion",
  "horas_invertidas"
];

const required = bulkHeaders.filter((header) => !["descripcion"].includes(header));

const headerAliases: Record<string, string> = {
  en_servicio: "servicio_integracion",
  aplicativo_se_encuentra: "aplicativo_activo"
};

function normalizeHeader(header: string) {
  return headerAliases[header] ?? header;
}

function splitLine(line: string) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  return line.split(",");
}

function exact(value: string, allowed: string[]) {
  return allowed.find((item) => item.trim().toLowerCase() === value.trim().toLowerCase()) ?? null;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseBulkText(text: string, masters: MasterData, tickets: Ticket[] = [], profile: Profile | null = null) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { records: [] as TimeEntry[], errors: ["Pega encabezados y al menos una fila."] };

  const headers = splitLine(lines[0]).map((item) => normalizeHeader(item.trim()));
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length) return { records: [] as TimeEntry[], errors: [`Faltan columnas: ${missing.join(", ")}`] };

  const records: TimeEntry[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, index) => {
    const values = splitLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() ?? ""]));
    const rowErrors: string[] = [];
    const ticketCode = row.codigo_tck.trim().toUpperCase();
    const ticket = tickets.find((item) => item.codigo_tck.toUpperCase() === ticketCode);
    const horas = Number(row.horas_invertidas);
    const resourceName = profile?.resource_name ?? "";

    if (!isIsoDate(row.fecha_reporte)) rowErrors.push(`fecha_reporte debe tener formato aaaa-mm-dd: ${row.fecha_reporte}`);
    if (!ticket) rowErrors.push(`codigo_tck no existe o no esta asignado al usuario: ${row.codigo_tck}`);
    if (ticket && ticket.approval_status !== "Aprobado") rowErrors.push(`codigo_tck no esta aprobado para registrar horas: ${row.codigo_tck}`);
    if (ticket && isIsoDate(row.fecha_reporte) && !ticketMatchesReportPeriod(ticket, row.fecha_reporte)) {
      rowErrors.push(ticketPeriodValidationMessage(ticket, row.fecha_reporte));
    }
    if (!horas || horas <= 0) rowErrors.push("horas_invertidas debe ser mayor a cero");
    if (horas > 8) rowErrors.push("horas_invertidas no puede ser mayor a 8");
    if (!resourceName) rowErrors.push("Tu usuario no tiene recurso asignado.");
    if (ticket && resourceName && !ticket.responsables.includes(resourceName)) {
      rowErrors.push(`codigo_tck no esta asignado a tu usuario: ${row.codigo_tck}`);
    }
    if (ticket && ticket.formato.split("|").map((item) => item.trim()).some((item) => item && !exact(item, masters.sociedades))) {
      rowErrors.push(`el ticket tiene una sociedad que no existe en maestras: ${ticket.formato}`);
    }

    if (rowErrors.length) {
      errors.push(`Fila ${index + 2}: ${rowErrors.join(", ")}`);
      return;
    }

    records.push({
      id: crypto.randomUUID(),
      fecha_reporte: row.fecha_reporte,
      codigo_tck: ticketCode,
      usuario_reporta: ticket!.usuario_solicitante,
      recurso: resourceName,
      aplicativo: ticket!.sistema,
      fecha_inicio: ticket!.fecha_solicitud,
      fecha_fin: ticket!.fecha_termino,
      descripcion: row.descripcion ?? "",
      sociedad: ticket!.formato,
      tipo_atencion: `${ticket!.tipo_atencion} - ${ticket!.subcategoria_atencion}`,
      horas_invertidas: horas,
      estado_tck: ticket!.estado === "Cancelado" ? "Pendiente" : ticket!.estado,
      en_servicio: ticket!.en_servicio,
      aplicativo_se_encuentra: ticket!.aplicativo_se_encuentra,
      modificado: new Date().toISOString()
    });
  });

  return { records, errors };
}
