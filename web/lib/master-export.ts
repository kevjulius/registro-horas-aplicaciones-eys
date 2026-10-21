import type { BiMasterData, MasterData } from "./types";

type CsvValue = string | number | null;

function csvCell(value: CsvValue) {
  const text = String(value ?? "");
  const safe = /^[\s\uFEFF]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csv(rows: CsvValue[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function applicationMastersCsv(masters: MasterData) {
  const rows: CsvValue[][] = [["Maestra", "Nombre", "Sociedad / empresa", "Servicio", "Fecha creacion",
    "Tipo de atencion", "Subcategoria", "Maximo dias"]];
  const simple = (label: string, names: string[]) => names.forEach((name) => rows.push([label, name, "", "", "", "", "", ""]));
  simple("Recursos", masters.recursos);
  simple("Usuarios que reportan", masters.usuariosReporta);
  const apps = new Map(masters.aplicacionesDetalle.map((item) => [item.name, item]));
  for (const name of masters.aplicaciones) {
    const detail = apps.get(name);
    rows.push(["Aplicativos", name, detail?.company ?? "", detail?.service ?? "", detail?.fecha_creacion ?? "", "", "", ""]);
  }
  simple("Sociedades", masters.sociedades);
  const attention = new Map(masters.tiposAtencionDetalle.map((item) => [item.name, item]));
  const types = new Set<string>();
  for (const name of masters.tiposAtencion) {
    const detail = attention.get(name);
    const [type, ...classification] = name.split(" - ");
    const attentionType = detail?.type || type.trim();
    if (attentionType) types.add(attentionType);
    rows.push(["Tipos de atencion", name, "", "", "", attentionType, detail?.classification ?? classification.join(" - ").trim(), ""]);
  }
  const rules = new Map(masters.attentionRules.map((rule) => [rule.tipo_atencion, rule.max_dias]));
  for (const type of new Set([...types, ...rules.keys()])) {
    rows.push(["Reglas de atencion", type, "", "", "", type, "", rules.get(type) ?? null]);
  }
  return csv(rows);
}

export function biMastersCsv(masters: BiMasterData) {
  const rows: CsvValue[][] = [["Maestra", "Nombre", "Codigo"]];
  const simple = (label: string, names: string[]) => names.forEach((name) => rows.push([label, name, ""]));
  simple("Recursos", masters.recursos);
  simple("Servicios", masters.servicios);
  masters.atenciones.forEach((item) => rows.push(["Atenciones", item.name, item.code]));
  simple("Estados", masters.estados);
  simple("Formatos", masters.formatos);
  return csv(rows);
}

export function downloadMasterCsv(contents: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
