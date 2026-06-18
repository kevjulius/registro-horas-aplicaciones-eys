import type { MasterData, Profile, Ticket, TimeEntry } from "./types";
import { ticketPeriodValidationMessage, ticketMatchesReportPeriod } from "./ticket-period";

export const bulkHeaders = [
  "fecha_reporte",
  "codigo_tck",
  "usuario_reporta",
  "recurso",
  "aplicativo",
  "fecha_inicio",
  "fecha_fin",
  "descripcion",
  "sociedad",
  "tipo_atencion",
  "horas_invertidas",
  "estado_tck",
  "en_servicio",
  "aplicativo_se_encuentra"
];

const required = bulkHeaders.filter((header) => !["fecha_fin", "descripcion"].includes(header));

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

  const headers = splitLine(lines[0]).map((item) => item.trim());
  const missing = required.filter((col) => !headers.includes(col));
  if (missing.length) return { records: [] as TimeEntry[], errors: [`Faltan columnas: ${missing.join(", ")}`] };

  const records: TimeEntry[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, index) => {
    const values = splitLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() ?? ""]));
    const rowErrors: string[] = [];
    const usuario = exact(row.usuario_reporta, masters.usuariosReporta);
    const recurso = exact(row.recurso, masters.recursos);
    const aplicativo = exact(row.aplicativo, masters.aplicaciones);
    const tipo = exact(row.tipo_atencion, masters.tiposAtencion);
    const ticketCode = row.codigo_tck.trim().toUpperCase();
    const ticket = tickets.find((item) => item.codigo_tck.toUpperCase() === ticketCode);
    const sociedades = row.sociedad
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);
    const sociedadesValidas = sociedades.map((item) => exact(item, masters.sociedades));
    const horas = Number(row.horas_invertidas);

    if (!isIsoDate(row.fecha_reporte)) rowErrors.push(`fecha_reporte debe tener formato aaaa-mm-dd: ${row.fecha_reporte}`);
    if (!isIsoDate(row.fecha_inicio)) rowErrors.push(`fecha_inicio debe tener formato aaaa-mm-dd: ${row.fecha_inicio}`);
    if (row.fecha_fin && !isIsoDate(row.fecha_fin)) rowErrors.push(`fecha_fin debe tener formato aaaa-mm-dd: ${row.fecha_fin}`);
    if (!usuario) rowErrors.push(`usuario_reporta no existe: ${row.usuario_reporta}`);
    if (!ticket) rowErrors.push(`codigo_tck no existe o no esta asignado al usuario: ${row.codigo_tck}`);
    if (ticket && ticket.approval_status !== "Aprobado") rowErrors.push(`codigo_tck no esta aprobado para registrar horas: ${row.codigo_tck}`);
    if (ticket && isIsoDate(row.fecha_reporte) && !ticketMatchesReportPeriod(ticket, row.fecha_reporte)) {
      rowErrors.push(ticketPeriodValidationMessage(ticket, row.fecha_reporte));
    }
    if (!recurso) rowErrors.push(`recurso no existe: ${row.recurso}`);
    if (!aplicativo) rowErrors.push(`aplicativo no existe: ${row.aplicativo}`);
    if (!tipo) rowErrors.push(`tipo_atencion no existe: ${row.tipo_atencion}`);
    if (!sociedades.length || sociedadesValidas.some((item) => !item)) rowErrors.push(`sociedad invalida: ${row.sociedad}`);
    if (!horas || horas <= 0) rowErrors.push("horas_invertidas debe ser mayor a cero");
    if (horas > 8) rowErrors.push("horas_invertidas no puede ser mayor a 8");
    if (!["En Proceso", "Cerrado", "Pendiente"].includes(row.estado_tck)) rowErrors.push(`estado_tck invalido: ${row.estado_tck}`);
    if (!["Si", "No"].includes(row.en_servicio)) rowErrors.push(`en_servicio invalido: ${row.en_servicio}`);
    if (!["Si", "No"].includes(row.aplicativo_se_encuentra)) rowErrors.push(`aplicativo_se_encuentra invalido: ${row.aplicativo_se_encuentra}`);
    if (profile?.role === "trabajador" && recurso && recurso !== profile.resource_name) {
      rowErrors.push(`recurso no corresponde a tu usuario: ${row.recurso}`);
    }
    if (profile?.role === "trabajador" && ticket && !ticket.responsables.includes(profile.resource_name ?? "")) {
      rowErrors.push(`codigo_tck no esta asignado a tu usuario: ${row.codigo_tck}`);
    }

    if (rowErrors.length) {
      errors.push(`Fila ${index + 2}: ${rowErrors.join(", ")}`);
      return;
    }

    records.push({
      id: crypto.randomUUID(),
      fecha_reporte: row.fecha_reporte,
      codigo_tck: ticketCode,
      usuario_reporta: usuario!,
      recurso: recurso!,
      aplicativo: aplicativo!,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      descripcion: row.descripcion ?? "",
      sociedad: sociedadesValidas.join(" | "),
      tipo_atencion: tipo!,
      horas_invertidas: horas,
      estado_tck: row.estado_tck as TimeEntry["estado_tck"],
      en_servicio: row.en_servicio as "Si" | "No",
      aplicativo_se_encuentra: row.aplicativo_se_encuentra as "Si" | "No",
      modificado: new Date().toISOString()
    });
  });

  return { records, errors };
}
