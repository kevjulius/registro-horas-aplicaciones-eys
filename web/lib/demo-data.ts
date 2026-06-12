import type { MasterData, Profile, TimeEntry } from "./types";

export const demoProfiles: Profile[] = [
  {
    id: "admin",
    email: "evelyne.vera@app.local",
    display_name: "Evelyne Vera",
    role: "administracion",
    resource_name: "Evelyne Vera",
    active: true
  },
  {
    id: "kevin",
    email: "kevin.medina@app.local",
    display_name: "Kevin Medina",
    role: "trabajador",
    resource_name: "Kevin Medina",
    active: true
  }
];

export const demoMasterData: MasterData = {
  recursos: ["Kevin Medina", "Evelyne Vera", "Darick Figueroa Mego", "Gianfranco Medina"],
  usuariosReporta: ["Magalli Vera", "Evelyne Vera", "Kevin Medina"],
  aplicaciones: ["ADT - Reflexis", "BOT - CUL", "RPA - Massimo", "RPA - Aperturas"],
  sociedades: ["A124 - MAKRO", "A125 - Food retail", "A126 - Hard discount"],
  tiposAtencion: [
    "Actividades Internas - Atenciones Urgentes",
    "Actividades Internas - Vacaciones",
    "Incidencia - Error del Sistema"
  ]
};

export const demoEntries: TimeEntry[] = [
  {
    id: "demo-1",
    fecha_reporte: "2026-06-11",
    codigo_tck: "ACT001",
    usuario_reporta: "Magalli Vera",
    recurso: "Kevin Medina",
    aplicativo: "BOT - CUL",
    fecha_inicio: "2026-06-11",
    fecha_fin: "2026-06-11",
    descripcion: "Registro de ejemplo",
    sociedad: "A126 - Hard discount",
    tipo_atencion: "Actividades Internas - Atenciones Urgentes",
    horas_invertidas: 1,
    estado_tck: "En Proceso",
    en_servicio: "No",
    aplicativo_se_encuentra: "Si",
    modificado: new Date().toISOString()
  }
];
