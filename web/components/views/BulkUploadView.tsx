"use client";

import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import { bulkHeaders, parseBulkText } from "@/lib/bulk";
import { saveEntries } from "@/lib/repository";
import { estados, siNo } from "@/components/app-shared";
import type { MasterData, Profile, Ticket } from "@/lib/types";

function xmlCell(value: string | number) {
  const escaped = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<Cell><Data ss:Type="String">${escaped}</Data></Cell>`;
}

function xmlColumns(dateColumns: string[] = []) {
  return bulkHeaders
    .map((header) => dateColumns.includes(header) ? `<Column ss:StyleID="dateIso"/>` : "<Column/>")
    .join("");
}

function worksheetOptions(hidden = false) {
  return hidden
    ? `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><Visible>SheetHidden</Visible></WorksheetOptions>`
    : "";
}

function xmlSheet(
  name: string,
  rows: Array<Array<string | number>>,
  validations = "",
  options: { hidden?: boolean; dateColumns?: string[] } = {}
) {
  const safeName = name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  const columns = options.dateColumns?.length ? xmlColumns(options.dateColumns) : "";
  return `<Worksheet ss:Name="${safeName}"><Table>${columns}${rows
    .map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`)
    .join("")}</Table>${validations}${worksheetOptions(Boolean(options.hidden))}</Worksheet>`;
}

function namedRange(name: string, sheet: string, count: number) {
  const safeCount = Math.max(count + 1, 2);
  return `<NamedRange ss:Name="${name}" ss:RefersTo="='${sheet}'!R2C1:R${safeCount}C1"/>`;
}

function listValidation(columnName: string, namedList: string, rows = 500) {
  const column = bulkHeaders.indexOf(columnName) + 1;
  if (!column) return "";

  return `<DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
    <Range>R2C${column}:R${rows}C${column}</Range>
    <Type>List</Type>
    <Value>=${namedList}</Value>
  </DataValidation>`;
}

function downloadBulkTemplate(masters: MasterData) {
  const validations = [
    listValidation("usuario_reporta", "lista_usuarios_reporta"),
    listValidation("recurso", "lista_recursos"),
    listValidation("aplicativo", "lista_aplicativos"),
    listValidation("tipo_atencion", "lista_tipos_atencion"),
    listValidation("estado_tck", "lista_estados"),
    listValidation("servicio_integracion", "lista_si_no"),
    listValidation("aplicativo_activo", "lista_si_no")
  ].join("");

  const blankRows = Array.from({ length: 499 }, () => bulkHeaders.map(() => ""));

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="dateIso">
      <NumberFormat ss:Format="yyyy-mm-dd"/>
    </Style>
  </Styles>
  <Names>
    ${namedRange("lista_recursos", "Recursos", masters.recursos.length)}
    ${namedRange("lista_usuarios_reporta", "Usuarios reporta", masters.usuariosReporta.length)}
    ${namedRange("lista_aplicativos", "Aplicativos", masters.aplicaciones.length)}
    ${namedRange("lista_sociedades", "Sociedades", masters.sociedades.length)}
    ${namedRange("lista_tipos_atencion", "Tipos atencion", masters.tiposAtencion.length)}
    ${namedRange("lista_estados", "Estados", estados.length)}
    ${namedRange("lista_si_no", "Si No", siNo.length)}
  </Names>
  ${xmlSheet("Plantilla", [bulkHeaders, ...blankRows], validations, { dateColumns: ["fecha_reporte", "fecha_inicio", "fecha_fin"] })}
  ${xmlSheet("Recursos", [["recurso"], ...masters.recursos.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Usuarios reporta", [["usuario_reporta"], ...masters.usuariosReporta.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Aplicativos", [["aplicativo"], ...masters.aplicaciones.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Sociedades", [["sociedad"], ...masters.sociedades.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Tipos atencion", [["tipo_atencion"], ...masters.tiposAtencion.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Estados", [["estado_tck"], ...estados.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Si No", [["valor"], ...siNo.map((item) => [item])], "", { hidden: true })}
  ${xmlSheet("Notas", [
    ["Campo", "Nota"],
    ["sociedad", "Para una o varias sociedades, escribir valores exactos separados con |. Ejemplo: A124 - MAKRO | A125 - Food retail."],
    ["fechas", "Usar formato YYYY-MM-DD."],
    ["horas_invertidas", "Usar numero mayor a cero y maximo 8."]
  ])}
</Workbook>`;

  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_carga_masiva_horas.xls";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BulkUploadView({ profile, masters, tickets, onSaved }: { profile: Profile; masters: MasterData; tickets: Ticket[]; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseBulkText(text, masters, tickets, profile) : { records: [], errors: [] }), [text, masters, tickets, profile]);
  const blocked = profile.role === "trabajador" && parsed.records.some((record) => record.recurso !== profile.resource_name);

  async function save() {
    if (blocked || parsed.errors.length || !parsed.records.length) return;
    await saveEntries(parsed.records);
    setSaveMessage(`Carga masiva guardada con exito. Registros: ${parsed.records.length}.`);
    setText("");
    onSaved();
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Carga masiva</h2>
          <p className="muted">Descarga la plantilla para copiar/pegar las filas (incluyendo los titulos). El sistema validara el registro y mostrara los registros validos o con errores.</p>
        </div>
        <div className="toolbar">
          <button className="secondary" type="button" onClick={() => downloadBulkTemplate(masters)}>
            <Download size={16} /> Descargar plantilla Excel
          </button>
          <button className="secondary" type="button" onClick={() => { setText(""); setSaveMessage(""); }}>
            <X size={16} /> Limpiar campo
          </button>
        </div>
      </div>
      <label>
        Pega aqui los datos copiados desde Excel
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="fecha_reporte	codigo_tck	usuario_reporta	..." />
      </label>
      {parsed.errors.length > 0 && <div className="notice">{parsed.errors.slice(0, 10).map((error) => <p key={error}>{error}</p>)}</div>}
      {blocked && <div className="notice">La carga contiene registros de otro recurso.</div>}
      {saveMessage && <div className="notice">{saveMessage}</div>}
      <div className="toolbar">
        <span className="pill">Registros validos: {parsed.records.length}</span>
        <span className="pill muted-pill">Errores: {parsed.errors.length}</span>
      </div>
      {parsed.records.length > 0 && (
        <div className="card table-card">
          <div className="section-head compact">
            <h3>Vista previa</h3>
            <span className="muted">Primeros {Math.min(parsed.records.length, 20)} registros</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>TCK</th><th>Usuario</th><th>Recurso</th><th>Aplicativo</th><th>Sociedad</th><th>Horas</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {parsed.records.slice(0, 20).map((record) => (
                <tr key={record.id}>
                  <td>{record.fecha_reporte}</td>
                  <td>{record.codigo_tck}</td>
                  <td>{record.usuario_reporta}</td>
                  <td>{record.recurso}</td>
                  <td>{record.aplicativo}</td>
                  <td>{record.sociedad}</td>
                  <td>{record.horas_invertidas}</td>
                  <td><span className={`status ${record.estado_tck === "Cerrado" ? "closed" : "progress"}`}>{record.estado_tck}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button disabled={blocked || parsed.errors.length > 0 || parsed.records.length === 0} onClick={save}>Guardar carga masiva</button>
    </section>
  );
}
