import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/master-export.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", compiled)(module, module.exports);
const { applicationMastersCsv, biMastersCsv, downloadMasterCsv } = module.exports;
const masters = {
  recursos: ["Recurso Uno", "=HYPERLINK(\"https://example.test\")"], usuariosReporta: ["Solicitante SPSA"],
  aplicaciones: ["Sistema A", "Sistema B", "Sin detalle"],
  aplicacionesDetalle: [
    { name: "Sistema B", company: "A125", service: "Servicio B", fecha_creacion: "" },
    { name: "Sistema A", company: "A124; A125", service: "Revisi\u00f3n \"especial\"\ny soporte", fecha_creacion: "2026-10-21" }
  ],
  sociedades: ["A124", "A125"], tiposAtencion: ["Soporte - An\u00e1lisis", "Proyecto - Desarrollo"],
  tiposAtencionDetalle: [{ name: "Soporte - An\u00e1lisis", type: "Soporte", classification: "An\u00e1lisis" }],
  attentionRules: [{ tipo_atencion: "Soporte", max_dias: 15 }, { tipo_atencion: "Regla adicional", max_dias: null }]
};
const original = structuredClone(masters);
const csv = applicationMastersCsv(masters);
assert(csv.startsWith('\uFEFF"Maestra";"Nombre"'));
for (const group of ["Recursos", "Usuarios que reportan", "Aplicativos", "Sociedades", "Tipos de atencion", "Reglas de atencion"]) {
  assert(csv.includes(`"${group}";`));
}
assert(csv.includes('"Aplicativos";"Sistema A";"A124; A125";"Revisi\u00f3n ""especial""\ny soporte";"2026-10-21"'));
assert(csv.includes('"Aplicativos";"Sistema B";"A125";"Servicio B";""'));
assert(csv.includes('"Aplicativos";"Sin detalle";"";"";""'));
assert(csv.includes('"Tipos de atencion";"Proyecto - Desarrollo";"";"";"";"Proyecto";"Desarrollo"'));
assert(csv.includes('"Reglas de atencion";"Soporte";"";"";"";"Soporte";"";"15"'));
assert(csv.includes('"Reglas de atencion";"Proyecto";"";"";"";"Proyecto";"";""'));
assert(csv.includes('"Reglas de atencion";"Regla adicional"'));
assert(csv.includes('"\'=HYPERLINK(""https://example.test"")"'));
assert.deepEqual(masters, original, "Export must not modify the masters");
const empty = { recursos: [], usuariosReporta: [], aplicaciones: [], aplicacionesDetalle: [], sociedades: [], tiposAtencion: [], tiposAtencionDetalle: [], attentionRules: [] };
assert.equal(applicationMastersCsv(empty).split("\r\n").length, 1);
const many = { ...empty, recursos: Array.from({ length: 1505 }, (_, i) => `Recurso ${i}`) };
assert.equal(applicationMastersCsv(many).split("\r\n").length, 1506, "Export must not limit the loaded records");

const bi = { recursos: ["BI Uno"], servicios: ["Servicio BI"], atenciones: [{ name: "Solicitud", code: "SOL" }], estados: ["Cerrado"], formatos: ["A125"] };
const biCsv = biMastersCsv(bi);
for (const group of ["Recursos", "Servicios", "Atenciones", "Estados", "Formatos"]) assert(biCsv.includes(`"${group}";`));
assert(biCsv.includes('"Atenciones";"Solicitud";"SOL"'));
assert.equal(biCsv.split("\r\n").length, 6);
for (const name of ["=formula", "+formula", "-formula", "@formula", "\t=formula", "\n=formula"]) {
  assert(applicationMastersCsv({ ...empty, recursos: [name] }).includes(`"'${name}"`));
}

const nativeCreate = URL.createObjectURL, nativeRevoke = URL.revokeObjectURL;
let blob, clicked = false, removed = false, revoked = false;
const link = { click() { clicked = true; }, remove() { removed = true; } };
globalThis.document = { createElement(tag) { assert.equal(tag, "a"); return link; }, body: { appendChild(value) { assert.equal(value, link); } } };
URL.createObjectURL = value => { blob = value; return "blob:fixture"; };
URL.revokeObjectURL = url => { assert.equal(url, "blob:fixture"); revoked = true; };
try {
  downloadMasterCsv(csv, "maestras_aplicaciones_2026-10-21.csv");
  assert(clicked && removed);
  assert.equal(link.download, "maestras_aplicaciones_2026-10-21.csv");
  assert.equal(blob.type, "text/csv;charset=utf-8");
  assert.equal(await blob.text(), csv.slice(1));
  await new Promise(resolve => setTimeout(resolve, 10));
  assert(revoked);
} finally {
  URL.createObjectURL = nativeCreate;
  URL.revokeObjectURL = nativeRevoke;
  delete globalThis.document;
}
console.log("PASS: all application/BI catalogs, complete details, empty/unlimited values, 1505 rows, accents/quotes/newlines, formula protection, download and no data mutations.");
