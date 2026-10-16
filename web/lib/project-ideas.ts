import type { ProjectIdea } from "./types";

export const quotationStatuses: ProjectIdea["estado_cotizacion"][] = ["Por entregar", "Por aprobar", "Aprobado"];
export const projectAttentionStatuses: ProjectIdea["estado_atencion"][] = [
  "Por aprobar cotizacion", "Por iniciar", "En analisis", "En desarrollo",
  "En pruebas", "En pase a produccion", "Cerrado"
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function isProjectPlanning(ticket: { tipo_atencion: string; subcategoria_atencion: string }) {
  return normalize(ticket.tipo_atencion) === "anteproyecto"
    && normalize(ticket.subcategoria_atencion) === "planificacion";
}

export type ProjectIdeaUpdate = Pick<ProjectIdea,
  "horas_estimacion" | "costo_cotizacion" | "estado_cotizacion" | "fecha_inicio" | "fecha_fin" | "estado_atencion" | "bloqueantes"
>;

export function cleanProjectIdeaUpdate(input: Record<string, unknown>): ProjectIdeaUpdate {
  function amount(key: string) {
    const value = input[key];
    if (value === null || value === "") return null;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 9999999999.99) {
      throw new Error("Las horas y el costo deben ser numeros positivos o cero.");
    }
    return Math.round(value * 100) / 100;
  }
  function date(key: string) {
    const value = input[key];
    if (value === null || value === "") return null;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
      throw new Error("La fecha indicada no es valida.");
    }
    return value;
  }
  if (!quotationStatuses.includes(input.estado_cotizacion as ProjectIdea["estado_cotizacion"])
    || !projectAttentionStatuses.includes(input.estado_atencion as ProjectIdea["estado_atencion"])) {
    throw new Error("El estado indicado no es valido.");
  }
  const fecha_inicio = date("fecha_inicio");
  const fecha_fin = date("fecha_fin");
  if (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio) throw new Error("La fecha fin no puede ser anterior a la fecha inicio.");
  if (typeof input.bloqueantes !== "string") throw new Error("Los bloqueantes deben ser texto.");
  return {
    horas_estimacion: amount("horas_estimacion"),
    costo_cotizacion: amount("costo_cotizacion"),
    estado_cotizacion: input.estado_cotizacion as ProjectIdea["estado_cotizacion"],
    fecha_inicio, fecha_fin,
    estado_atencion: input.estado_atencion as ProjectIdea["estado_atencion"],
    bloqueantes: input.bloqueantes.trim()
  };
}
