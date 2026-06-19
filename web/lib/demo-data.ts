import type { BiEntry, BiMasterData, MasterData, Profile, Team, Ticket, TimeEntry } from "./types";

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
    role: "trabajador_aplicaciones",
    resource_name: "Kevin Medina",
    active: true
  }
];

export const demoBiMasters: BiMasterData = {
  recursos: ["Kevin Medina", "Evelyne Vera", "Darick Figueroa Mego", "Gianfranco Medina"],
  servicios: ["Reporte BI", "Extraccion de datos", "Soporte BI"],
  atenciones: [
    { name: "Soporte", code: "SOP" },
    { name: "Proyecto", code: "PRO" },
    { name: "Requerimiento", code: "REQ" }
  ],
  estados: ["Pendiente", "En Proceso", "Cerrado", "Cancelado"],
  formatos: ["BI", "Power BI", "Excel"]
};

export const demoBiEntries: BiEntry[] = [];

export const demoMasterData: MasterData = {
  recursos: ["Kevin Medina", "Evelyne Vera", "Darick Figueroa Mego", "Gianfranco Medina"],
  usuariosReporta: ["Magalli Vera", "Evelyne Vera", "Kevin Medina"],
  aplicaciones: ["ADT - Reflexis", "BOT - CUL", "RPA - Massimo", "RPA - Aperturas"],
  aplicacionesDetalle: [
    { name: "ADT - Reflexis", company: "Food Retail, MAKRO", service: "Soporte Aplicaciones Operacion", fecha_creacion: "" },
    { name: "BOT - CUL", company: "Administracion Food Regional", service: "Soporte Aplicaciones Operacion", fecha_creacion: "" },
    { name: "RPA - Massimo", company: "Hard discount", service: "Soporte RPA - Automatizacion de Procesos", fecha_creacion: "" },
    { name: "RPA - Aperturas", company: "Administracion Food Regional", service: "Soporte RPA - Automatizacion de Procesos", fecha_creacion: "" }
  ],
  sociedades: ["A124 - MAKRO", "A125 - Food retail", "A126 - Hard discount"],
  tiposAtencion: [
    "Actividades Internas - Atenciones Urgentes",
    "Actividades Internas - Vacaciones",
    "Incidencia - Error del Sistema"
  ],
  tiposAtencionDetalle: [
    { name: "Actividades Internas - Atenciones Urgentes", type: "Actividades Internas", classification: "Atenciones Urgentes" },
    { name: "Actividades Internas - Vacaciones", type: "Actividades Internas", classification: "Vacaciones" },
    { name: "Incidencia - Error del Sistema", type: "Incidencia", classification: "Error del Sistema" }
  ],
  attentionRules: [
    { tipo_atencion: "Soporte", max_dias: 15 }
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

export const demoTeams: Team[] = [
  {
    id: "team-bot",
    name: "BOT",
    active: true,
    resources: ["Kevin Medina", "Evelyne Vera"],
    profile_ids: ["admin", "kevin"]
  }
];

export const demoTickets: Ticket[] = [
  {
    id: "ticket-demo-1",
    codigo_tck: "ACT001",
    fecha_solicitud: "2026-06-11",
    sistema: "BOT - CUL",
    formato: "A126 - Hard discount",
    usuario_solicitante: "Magalli Vera",
    fecha_recepcion: "2026-06-11",
    subject_correo: "Ticket de ejemplo",
    alcance_correo: "Registro de ejemplo para validar el flujo.",
    tipo_atencion: "Actividades Internas",
    subcategoria_atencion: "Atenciones Urgentes",
    estado: "En Proceso",
    fecha_termino: "2026-06-11",
    tipo_tck: "Personal",
    en_servicio: "No",
    aplicativo_se_encuentra: "Si",
    approval_status: "Aprobado",
    rejection_reason: "",
    responsables: ["Kevin Medina"],
    active: true
  }
];
