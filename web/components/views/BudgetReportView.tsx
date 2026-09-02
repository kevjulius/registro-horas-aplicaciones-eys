"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import type { ApplicationBudget, BiEntry, Profile, TimeEntry } from "@/lib/types";

type TeamName = "Aplicaciones" | "BI";

type Consumption = {
  equipo: TeamName;
  sistema: string;
  sociedad: string;
  horas: number;
};

type ReportRow = {
  equipo: TeamName;
  sistema: string;
  sociedad: string;
  presupuesto: number;
  consumo: number;
  diferencia: number;
  usado: number | null;
  estado: "Presupuestado" | "Sin presupuesto";
  material_cf: string;
  glosa_pl: string;
};

const monthOptions = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
];

const excludedAttentionTypes = new Set(["proyecto", "actividades internas"]);

function currentMonth() {
  return new Date().toISOString().slice(5, 7);
}

function currentYear() {
  return Number(new Date().toISOString().slice(0, 4));
}

function cleanKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function societyCode(value: string) {
  const clean = value.trim();
  const match = clean.match(/\bA\d{3}\b/i);
  return match ? match[0].toUpperCase() : clean;
}

function splitSocieties(value: string) {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function reportKey(equipo: TeamName, sistema: string, sociedad: string) {
  return `${equipo}::${cleanKey(sistema)}::${societyCode(sociedad)}`;
}

function csvValue(value: string | number | null) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").replace(/;/g, ",").trim();
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function attentionBaseType(value: string) {
  return value.split(" - ")[0]?.trim().toLowerCase() ?? "";
}

function buildBudgetIndex(budgets: ApplicationBudget[], year: number) {
  const byKey = new Map<string, ReportRow>();
  const societiesBySystem = new Map<string, Set<string>>();

  budgets
    .filter((budget) => budget.active && budget.anio === year)
    .forEach((budget) => {
      const equipo = budget.equipo;
      const sociedad = societyCode(budget.sociedad);
      const key = reportKey(equipo, budget.sistema, sociedad);
      const current = byKey.get(key);
      const systemKey = `${equipo}::${cleanKey(budget.sistema)}`;
      if (!societiesBySystem.has(systemKey)) societiesBySystem.set(systemKey, new Set());
      societiesBySystem.get(systemKey)?.add(sociedad);

      byKey.set(key, {
        equipo,
        sistema: current?.sistema ?? budget.sistema,
        sociedad,
        presupuesto: round((current?.presupuesto ?? 0) + Number(budget.horas_presupuestadas_mes)),
        consumo: current?.consumo ?? 0,
        diferencia: 0,
        usado: null,
        estado: "Presupuestado",
        material_cf: Array.from(new Set([current?.material_cf, budget.material_cf].filter(Boolean))).join(" | "),
        glosa_pl: Array.from(new Set([current?.glosa_pl, budget.glosa_pl].filter(Boolean))).join(" | ")
      });
    });

  return { byKey, societiesBySystem };
}

function allocateConsumption(consumption: Consumption, societiesBySystem: Map<string, Set<string>>) {
  const selected = splitSocieties(consumption.sociedad);
  const systemKey = `${consumption.equipo}::${cleanKey(consumption.sistema)}`;
  const budgetSocieties = Array.from(societiesBySystem.get(systemKey) ?? []);

  if (selected.some((value) => cleanKey(value) === "todos")) {
    const targets = budgetSocieties.length ? budgetSocieties : ["Todos"];
    const perSociety = consumption.horas / targets.length;
    return targets.map((sociedad) => ({ ...consumption, sociedad, horas: perSociety }));
  }

  const targets = selected.length ? selected.map(societyCode) : ["Sin sociedad"];
  const perSociety = consumption.horas / targets.length;
  return targets.map((sociedad) => ({ ...consumption, sociedad, horas: perSociety }));
}

function monthMatches(date: string, year: number, month: string) {
  return date.startsWith(`${year}-${month}`);
}

export function BudgetReportView({
  profile,
  budgets,
  entries,
  biEntries
}: {
  profile: Profile;
  budgets: ApplicationBudget[];
  entries: TimeEntry[];
  biEntries: BiEntry[];
}) {
  const isBiOnly = profile.role === "adminbi";
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(budgets.map((budget) => budget.anio))).sort((a, b) => b - a);
    return years.length ? years : [currentYear()];
  }, [budgets]);
  const [year, setYear] = useState(availableYears.includes(2026) ? 2026 : availableYears[0]);
  const [month, setMonth] = useState(currentMonth());
  const [team, setTeam] = useState<TeamName | "Todos">(isBiOnly ? "BI" : "Todos");
  const [system, setSystem] = useState("Todos");
  const [society, setSociety] = useState("Todos");
  const [status, setStatus] = useState("Todos");

  const reportRows = useMemo(() => {
    const { byKey, societiesBySystem } = buildBudgetIndex(budgets, year);
    const actualRows: Consumption[] = [
      ...entries
        .filter((entry) => monthMatches(entry.fecha_reporte, year, month))
        .filter((entry) => !excludedAttentionTypes.has(attentionBaseType(entry.tipo_atencion)))
        .filter((entry) => status === "Todos" || entry.estado_tck === status)
        .map((entry) => ({
          equipo: "Aplicaciones" as const,
          sistema: entry.aplicativo,
          sociedad: entry.sociedad,
          horas: Number(entry.horas_invertidas)
        })),
      ...biEntries
        .filter((entry) => monthMatches(entry.fecha_inicio, year, month))
        .filter((entry) => !excludedAttentionTypes.has(attentionBaseType(entry.tipo_atencion)))
        .filter((entry) => status === "Todos" || entry.estado === status)
        .map((entry) => ({
          equipo: "BI" as const,
          sistema: entry.servicio,
          sociedad: entry.formato,
          horas: Number(entry.esfuerzo_horas)
        }))
    ];

    actualRows
      .flatMap((row) => allocateConsumption(row, societiesBySystem))
      .forEach((row) => {
        const sociedad = societyCode(row.sociedad);
        const key = reportKey(row.equipo, row.sistema, sociedad);
        const current = byKey.get(key);
        byKey.set(key, {
          equipo: row.equipo,
          sistema: current?.sistema ?? row.sistema,
          sociedad,
          presupuesto: current?.presupuesto ?? 0,
          consumo: round((current?.consumo ?? 0) + row.horas),
          diferencia: 0,
          usado: null,
          estado: current?.estado ?? "Sin presupuesto",
          material_cf: current?.material_cf ?? "",
          glosa_pl: current?.glosa_pl ?? ""
        });
      });

    return Array.from(byKey.values())
      .map((row) => ({
        ...row,
        presupuesto: round(row.presupuesto),
        consumo: round(row.consumo),
        diferencia: round(row.presupuesto - row.consumo),
        usado: row.presupuesto > 0 ? round((row.consumo / row.presupuesto) * 100) : null,
        estado: row.presupuesto > 0 ? "Presupuestado" as const : "Sin presupuesto" as const
      }))
      .filter((row) => !isBiOnly || row.equipo === "BI")
      .sort((a, b) => a.equipo.localeCompare(b.equipo) || a.sistema.localeCompare(b.sistema) || a.sociedad.localeCompare(b.sociedad));
  }, [biEntries, budgets, entries, isBiOnly, month, status, year]);

  const systemOptions = useMemo(() => {
    return Array.from(new Set(reportRows.filter((row) => team === "Todos" || row.equipo === team).map((row) => row.sistema))).sort((a, b) => a.localeCompare(b));
  }, [reportRows, team]);

  const societyOptions = useMemo(() => {
    return Array.from(new Set(reportRows
      .filter((row) => (team === "Todos" || row.equipo === team) && (system === "Todos" || row.sistema === system))
      .map((row) => row.sociedad))).sort((a, b) => a.localeCompare(b));
  }, [reportRows, system, team]);

  const filteredRows = useMemo(() => reportRows.filter((row) =>
    (team === "Todos" || row.equipo === team)
    && (system === "Todos" || row.sistema === system)
    && (society === "Todos" || row.sociedad === society)
  ), [reportRows, society, system, team]);

  const totals = useMemo(() => {
    const presupuesto = filteredRows.reduce((sum, row) => sum + row.presupuesto, 0);
    const consumo = filteredRows.reduce((sum, row) => sum + row.consumo, 0);
    const sinPresupuesto = filteredRows.filter((row) => row.presupuesto === 0 && row.consumo > 0).reduce((sum, row) => sum + row.consumo, 0);
    return {
      presupuesto: round(presupuesto),
      consumo: round(consumo),
      diferencia: round(presupuesto - consumo),
      usado: presupuesto > 0 ? round((consumo / presupuesto) * 100) : 0,
      sinPresupuesto: round(sinPresupuesto)
    };
  }, [filteredRows]);

  function clearFilters() {
    setTeam(isBiOnly ? "BI" : "Todos");
    setSystem("Todos");
    setSociety("Todos");
    setStatus("Todos");
  }

  function exportCsv() {
    const headers = ["Equipo", "Sistema", "Sociedad", "HH presupuesto", "HH registradas", "Diferencia", "% usado", "Estado", "Material CF", "Glosa PL"];
    const rows = [
      headers.join(";"),
      ...filteredRows.map((row) => [
        row.equipo,
        row.sistema,
        row.sociedad,
        row.presupuesto,
        row.consumo,
        row.diferencia,
        row.usado ?? "",
        row.estado,
        row.material_cf,
        row.glosa_pl
      ].map(csvValue).join(";"))
    ];
    const blob = new Blob([`\uFEFF${rows.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `presupuesto_vs_consumo_${year}_${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Presupuesto vs Consumo</h2>
          <p className="muted">Compara las horas presupuestadas mensuales contra las horas reales registradas.</p>
        </div>
        <div className="toolbar">
          <button className="secondary" type="button" disabled={!filteredRows.length} onClick={exportCsv}>
            <Download size={16} /> Exportar CSV
          </button>
          <button className="secondary" type="button" onClick={clearFilters}>Limpiar filtros</button>
        </div>
      </div>

      <div className="card grid">
        <div className="grid grid-6 filters">
          <label>
            Año
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {availableYears.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Mes
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Equipo
            <select value={team} disabled={isBiOnly} onChange={(event) => { setTeam(event.target.value as TeamName | "Todos"); setSystem("Todos"); setSociety("Todos"); }}>
              {!isBiOnly && <option value="Todos">Todos</option>}
              <option value="Aplicaciones">Aplicaciones</option>
              <option value="BI">BI</option>
            </select>
          </label>
          <label>
            Sistema
            <select value={system} onChange={(event) => { setSystem(event.target.value); setSociety("Todos"); }}>
              <option value="Todos">Todos</option>
              {systemOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Sociedad
            <select value={society} onChange={(event) => setSociety(event.target.value)}>
              <option value="Todos">Todos</option>
              {societyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            Estado
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="Todos">Todos</option>
              <option value="En Proceso">En Proceso</option>
              <option value="Cerrado">Cerrado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </label>
        </div>
      </div>

      <div className="budget-summary">
        <div className="card metric-card">
          <span>HH presupuestadas</span>
          <strong>{totals.presupuesto}</strong>
        </div>
        <div className="card metric-card">
          <span>HH registradas</span>
          <strong>{totals.consumo}</strong>
        </div>
        <div className="card metric-card">
          <span>Diferencia</span>
          <strong>{totals.diferencia}</strong>
        </div>
        <div className="card metric-card">
          <span>% usado</span>
          <strong>{totals.usado}%</strong>
        </div>
        <div className="card metric-card warning-metric">
          <span>HH sin presupuesto</span>
          <strong>{totals.sinPresupuesto}</strong>
        </div>
      </div>

      <div className="card table-card budget-table-card">
        <table>
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Sistema</th>
              <th>Sociedad</th>
              <th>HH presupuesto</th>
              <th>HH registradas</th>
              <th>Diferencia</th>
              <th>% usado</th>
              <th>Estado</th>
              <th>Material CF</th>
              <th>Glosa PL</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.equipo}-${row.sistema}-${row.sociedad}`}>
                <td>{row.equipo}</td>
                <td>{row.sistema}</td>
                <td>{row.sociedad}</td>
                <td>{row.presupuesto}</td>
                <td>{row.consumo}</td>
                <td>{row.diferencia}</td>
                <td>{row.usado === null ? "-" : `${row.usado}%`}</td>
                <td>
                  <span className={row.estado === "Sin presupuesto" ? "status warning-status" : "status closed"}>{row.estado}</span>
                </td>
                <td>{row.material_cf || "-"}</td>
                <td className="description-cell">{row.glosa_pl || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <p className="muted">No hay presupuesto ni consumo para los filtros seleccionados.</p>}
      </div>
    </section>
  );
}
