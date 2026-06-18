import type { BiEntry, BiMasterData, Profile } from "./types";

export const biBulkHeaders = [
  "asignado_a",
  "formato",
  "solicitado_por",
  "servicio",
  "tipo_atencion",
  "estado",
  "fecha_inicio",
  "fecha_fin",
  "esfuerzo_horas",
  "descripcion"
];

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

export function parseBiBulkText(text: string, masters: BiMasterData, profile: Profile) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { records: [] as BiEntry[], errors: ["Pega encabezados y al menos una fila."] };

  const headers = splitLine(lines[0]).map((item) => item.trim());
  const missing = biBulkHeaders.filter((col) => !headers.includes(col));
  if (missing.length) return { records: [] as BiEntry[], errors: [`Faltan columnas: ${missing.join(", ")}`] };

  const records: BiEntry[] = [];
  const errors: string[] = [];
  const attentionNames = masters.atenciones.map((item) => item.name);

  lines.slice(1).forEach((line, index) => {
    const values = splitLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i]?.trim() ?? ""]));
    const rowErrors: string[] = [];
    const asignadoA = exact(row.asignado_a, masters.recursos);
    const formato = exact(row.formato, masters.formatos);
    const servicio = exact(row.servicio, masters.servicios);
    const tipoAtencion = exact(row.tipo_atencion, attentionNames);
    const estado = exact(row.estado, masters.estados);
    const horas = Number(row.esfuerzo_horas);

    if (!asignadoA) rowErrors.push(`asignado_a no existe: ${row.asignado_a}`);
    if (!formato) rowErrors.push(`formato no existe: ${row.formato}`);
    if (!row.solicitado_por.trim()) rowErrors.push("solicitado_por es obligatorio");
    if (!servicio) rowErrors.push(`servicio no existe: ${row.servicio}`);
    if (!tipoAtencion) rowErrors.push(`tipo_atencion no existe: ${row.tipo_atencion}`);
    if (!estado) rowErrors.push(`estado no existe: ${row.estado}`);
    if (!isIsoDate(row.fecha_inicio)) rowErrors.push(`fecha_inicio debe tener formato aaaa-mm-dd: ${row.fecha_inicio}`);
    if (!isIsoDate(row.fecha_fin)) rowErrors.push(`fecha_fin debe tener formato aaaa-mm-dd: ${row.fecha_fin}`);
    if (!horas || horas <= 0) rowErrors.push("esfuerzo_horas debe ser mayor a cero");
    if (horas > 8) rowErrors.push("esfuerzo_horas no puede ser mayor a 8");
    if (!row.descripcion.trim()) rowErrors.push("descripcion es obligatoria");
    if (profile.role === "trabajador_bi" && asignadoA && asignadoA !== profile.resource_name) {
      rowErrors.push(`asignado_a no corresponde a tu usuario: ${row.asignado_a}`);
    }

    if (rowErrors.length) {
      errors.push(`Fila ${index + 2}: ${rowErrors.join(", ")}`);
      return;
    }

    records.push({
      id: `new-${crypto.randomUUID()}`,
      correlativo: "",
      asignado_a: asignadoA!,
      formato: formato!,
      solicitado_por: row.solicitado_por.trim(),
      servicio: servicio!,
      tipo_atencion: tipoAtencion!,
      estado: estado!,
      fecha_inicio: row.fecha_inicio,
      fecha_fin: row.fecha_fin,
      esfuerzo_horas: horas,
      descripcion: row.descripcion.trim(),
      active: true
    });
  });

  return { records, errors };
}
