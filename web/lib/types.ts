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
  sociedades: string[];
  tiposAtencion: string[];
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
