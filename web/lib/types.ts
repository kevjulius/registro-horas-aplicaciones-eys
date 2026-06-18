export type Role = "trabajador" | "administracion";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  resource_name: string | null;
  active: boolean;
};

export type MasterData = {
  recursos: string[];
  usuariosReporta: string[];
  aplicaciones: string[];
  aplicacionesDetalle: ApplicationMaster[];
  sociedades: string[];
  tiposAtencion: string[];
};

export type ApplicationMaster = {
  name: string;
  company: string;
  service: string;
  fecha_creacion: string;
};

export type Team = {
  id: string;
  name: string;
  active: boolean;
  resources: string[];
  profile_ids: string[];
};

export type TimeEntry = {
  id: string;
  fecha_reporte: string;
  codigo_tck: string;
  usuario_reporta: string;
  recurso: string;
  aplicativo: string;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion: string;
  sociedad: string;
  tipo_atencion: string;
  horas_invertidas: number;
  estado_tck: "En Proceso" | "Cerrado" | "Pendiente";
  en_servicio: "Si" | "No";
  aplicativo_se_encuentra: "Si" | "No";
  created_by?: string | null;
  modificado: string;
};

export type TicketStatus = "Cerrado" | "Pendiente" | "En Proceso" | "Cancelado";
export type TicketApprovalStatus = "Pendiente" | "Aprobado" | "Rechazado";
export type TicketWorkType = "Personal" | "Grupal";
export type TicketAttentionType =
  | "Requerimiento"
  | "Proyecto"
  | "Anteproyecto"
  | "Soporte"
  | "Monitoreo"
  | "Incidencia"
  | "Actividades Internas";

export type Ticket = {
  id: string;
  codigo_tck: string;
  fecha_solicitud: string;
  sistema: string;
  formato: string;
  usuario_solicitante: string;
  fecha_recepcion: string;
  subject_correo: string;
  alcance_correo: string;
  tipo_atencion: TicketAttentionType;
  estado: TicketStatus;
  fecha_termino: string;
  tipo_tck: TicketWorkType;
  approval_status: TicketApprovalStatus;
  rejection_reason: string;
  requested_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  responsables: string[];
  active: boolean;
  created_at?: string;
  updated_at?: string;
};
