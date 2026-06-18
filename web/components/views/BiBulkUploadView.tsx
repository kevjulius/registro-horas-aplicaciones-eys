"use client";

import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { biBulkHeaders, parseBiBulkText } from "@/lib/bi-bulk";
import { saveBiEntries } from "@/lib/repository";
import type { BiMasterData, Profile } from "@/lib/types";

function xmlCell(value: string | number) {
  const escaped = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<Cell><Data ss:Type="String">${escaped}</Data></Cell>`;
}

function xmlColumns(dateColumns: string[] = []) {
  return biBulkHeaders.map((header) => dateColumns.includes(header) ? `<Column ss:StyleID="dateIso"/>` : "<Column/>").join("");
}

function worksheetOptions(hidden = false) {
  return hidden ? `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Visible>SheetHidden</Visible></WorksheetOptions>` : "";
}

function xmlSheet(name: string, rows: Array<Array<string | number>>, validations = "", options: { hidden?: boolean; dateColumns?: string[] } = {}) {
  const safeName = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  const columns = options.dateColumns?.length ? xmlColumns(options.dateColumns) : "";
  return `<Worksheet ss:Name="${safeName}"><Table>${columns}${rows.map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`).join("")}</Table>${validations}${worksheetOptions(Boolean(options.hidden))}</Worksheet>`;
}

function namedRange(name: string, sheet: string, count: number) {
  const safeCount = Math.max(count + 1, 2);
  return `<NamedRange ss:Name="${name}" ss:RefersTo="='${sheet}'!R2C1:R${safeCount}C1"/>`;
}

function listValidation(columnName: string, namedList: string, rows = 500) {
  const column = biBulkHeaders.indexOf(columnName) + 1;
  if (!column) return "";
  return `<DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
    <Range>R2C${column}:R${rows}C${column}</Range>
    <Type>List</Type>
    <Value>=${namedList}</Value>
  </DataValidation>`;
}

function downloadBiTemplate(masters: BiMasterData) {
  const attentionNames = masters.atenciones.map((item) => item.name);
  const validations = [
    listValidation("asignado_a", "lista_recursos"),
    listValidation("formato", "lista_formatos"),
    listValidation("servicio", "lista_servicios"),
    listValidation("tipo_atencion", "lista_atenciones"),
    listValidation("estado", "lista_estados")
  ].join("");
  const blankRows = Array.from({ length: 499 }, () => biBulkHeaders.map(() => ""));
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="dateIso"><NumberFormat ss:Format="yyyy-mm-dd"/></Style>
  </Styles>
  <Names>
    ${namedRange("lista_recursos", "Recursos", masters.recursos.length)}
    ${namedRange("lista_formatos", "Formatos", masters.formatos.length)}
    ${namedRange("lista_servicios", "Servicios", masters.servicios.length)}
    ${namedRange("lista_atenciones", "Atenciones", attentionNames.length)}
    ${namedRange("lista_estados", "Estados", masters.estados.length)}
  </Names>
  ${xmlSheet("Plantilla BI", [biBulkHeaders, ...blankRows], validations, { dateColumns: ["fecha_inicio", "fecha_fin"] })}
  ${xmlSheet("Recursos", [["asignado_a"], ...masters.recursos.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Formatos", [["formato"], ...masters.formatos.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Servicios", [["servicio"], ...masters.servicios.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Atenciones", [["tipo_atencion"], ...attentionNames.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Estados", [["estado"], ...masters.estados.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Notas", [
    ["Campo", "Nota"],
    ["correlativo", "No se llena. El sistema lo genera al guardar."],
    ["fechas", "Usar formato YYYY-MM-DD."],
    ["esfuerzo_horas", "Usar numero mayor a cero y maximo 8."],
    ["solicitado_por", "Texto libre."]
  ])}
</Workbook>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_carga_masiva_bi.xls";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BiBulkUploadView({ profile, masters, onSaved }: { profile: Profile; masters: BiMasterData; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseBiBulkText(text, masters, profile) : { records: [], errors: [] }), [text, masters, profile]);

  async function save() {
    if (parsed.errors.length || !parsed.records.length) return;
    await saveBiEntries(parsed.records);
    setSaveMessage(`Carga masiva BI guardada con exito. Registros: ${parsed.records.length}.`);
    setText("");
    onSaved();
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Carga masiva BI</h2>
          <p className="muted">Descarga la plantilla BI para copiar/pegar las filas. El sistema validara contra maestras BI.</p>
        </div>
        <div className="toolbar">
          <button className="secondary" type="button" onClick={() => downloadBiTemplate(masters)}>
            <Download size={16} /> Descargar plantilla BI
          </button>
          <button className="secondary" type="button" onClick={() => { setText(""); setSaveMessage(""); }}>
            <X size={16} /> Limpiar campo
          </button>
        </div>
      </div>
      <label>
        Pega aqui los datos BI copiados desde Excel
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="asignado_a	formato	solicitado_por	..." />
      </label>
      {parsed.errors.length > 0 && <div className="notice">{parsed.errors.slice(0, 10).map((error) => <p key={error}>{error}</p>)}</div>}
      {saveMessage && <div className="notice">{saveMessage}</div>}
      <div className="toolbar">
        <span className="pill">Registros validos: {parsed.records.length}</span>
        <span className="pill muted-pill">Errores: {parsed.errors.length}</span>
      </div>
      {parsed.records.length > 0 && (
        <div className="card table-card">
          <div className="section-head compact">
            <h3>Vista previa BI</h3>
            <span className="muted">Primeros {Math.min(parsed.records.length, 20)} registros</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Asignado a</th><th>Formato</th><th>Solicitado por</th><th>Servicio</th><th>Tipo</th><th>Estado</th><th>Inicio</th><th>Fin</th><th>Horas</th>
              </tr>
            </thead>
            <tbody>
              {parsed.records.slice(0, 20).map((record) => (
                <tr key={record.id}>
                  <td>{record.asignado_a}</td>
                  <td>{record.formato}</td>
                  <td>{record.solicitado_por}</td>
                  <td>{record.servicio}</td>
                  <td>{record.tipo_atencion}</td>
                  <td><span className="status progress">{record.estado}</span></td>
                  <td>{record.fecha_inicio}</td>
                  <td>{record.fecha_fin}</td>
                  <td>{record.esfuerzo_horas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button disabled={parsed.errors.length > 0 || parsed.records.length === 0} onClick={save}>Guardar carga masiva BI</button>
    </section>
  );
}
