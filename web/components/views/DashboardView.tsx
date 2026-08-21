"use client";

import { useEffect, useMemo, useState } from "react";
import { today } from "@/components/app-shared";
import type { BiEntry, ExpectedHoursByMonth, Profile, Team, TimeEntry } from "@/lib/types";

type ChartRow = {
  resource: string;
  hours: number;
};

type DailyRow = {
  date: string;
  label: string;
  hours: number;
};

function HoursChart({
  title,
  subtitle,
  rows,
  expectedHours,
  zeroResources
}: {
  title: string;
  subtitle: string;
  rows: ChartRow[];
  expectedHours: number;
  zeroResources: string[];
}) {
  const maxHours = Math.max(expectedHours, ...rows.map((row) => row.hours), 1);
  const chartTrackHeight = 220;
  const expectedRatio = Math.max(0, Math.min(1, expectedHours / maxHours));
  const expectedLineTop = `${(1 - expectedRatio) * chartTrackHeight}px`;
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
  const belowExpected = rows.filter((row) => row.hours < expectedHours).length;
  const chartStyle = { "--expected-top": expectedLineTop, "--resource-count": Math.max(rows.length, 1) } as React.CSSProperties;

  return (
    <div className="card dashboard-card">
      <div className="section-head compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="toolbar">
          <span className="pill">Recursos: {rows.length}</span>
          <span className="pill muted-pill">Horas: {Number(totalHours.toFixed(2))}</span>
          <span className="pill muted-pill">Debajo esperado: {belowExpected}</span>
        </div>
      </div>
      <div className="dashboard-content">
        <div className="dashboard-chart" style={chartStyle}>
          {rows.length > 0 && (
            <>
              <div className="dashboard-values">
                {rows.map((row) => <span className="bar-value" key={row.resource}>{row.hours}</span>)}
              </div>
              <div className="dashboard-plot">
                <div className="expected-line">
                  <span>{expectedHours}</span>
                </div>
                {rows.map((row) => {
                  const height = `${(row.hours / maxHours) * 100}%`;
                  return (
                    <div className="dashboard-bar-track" key={row.resource}>
                  <div
                    className={row.hours >= expectedHours ? "dashboard-bar ok" : "dashboard-bar"}
                    style={{ "--bar-height": height } as React.CSSProperties}
                  />
                    </div>
                  );
                })}
              </div>
              <div className="dashboard-labels">
                {rows.map((row) => <span className="bar-label" key={row.resource}>{row.resource}</span>)}
              </div>
            </>
          )}
          {rows.length === 0 && <p className="muted">No hay horas registradas para esos filtros.</p>}
        </div>
        <aside className="zero-resources-panel">
          <div>
            <h4>Sin horas registradas</h4>
            <span className="pill muted-pill">{zeroResources.length} recursos</span>
          </div>
          <div className="zero-resource-list">
            {zeroResources.map((resource) => (
              <span key={resource}>{resource}</span>
            ))}
            {zeroResources.length === 0 && <p className="muted">Todos registraron horas.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DailyHoursChart({
  title,
  rows,
  resource,
  month
}: {
  title: string;
  rows: DailyRow[];
  resource: string;
  month: string;
}) {
  const maxHours = Math.max(8, ...rows.map((row) => row.hours), 1);
  const totalHours = Number(rows.reduce((sum, row) => sum + row.hours, 0).toFixed(2));
  const belowEight = rows.filter((row) => row.hours > 0 && row.hours < 8).length;
  const aboveEight = rows.filter((row) => row.hours > 8).length;
  const chartStyle = { "--resource-count": Math.max(rows.length, 1) } as React.CSSProperties;

  return (
    <div className="card dashboard-card">
      <div className="section-head compact">
        <div>
          <h3>{title}</h3>
          <p className="muted">{resource ? `${resource} - ${month}` : "Selecciona un recurso para ver el detalle diario."}</p>
        </div>
        <div className="toolbar">
          <span className="pill">Dias registrados: {rows.length}</span>
          <span className="pill muted-pill">Horas: {totalHours}</span>
          <span className="pill muted-pill">Menos de 8h: {belowEight}</span>
          <span className="pill muted-pill">Mas de 8h: {aboveEight}</span>
        </div>
      </div>
      <div className="daily-dashboard-chart" style={chartStyle}>
        {rows.length > 0 ? (
          <>
            <div className="dashboard-values">
              {rows.map((row) => (
                <span className={row.hours > 8 ? "bar-value danger" : row.hours < 8 ? "bar-value warning" : "bar-value"} key={row.date}>
                  {row.hours}
                </span>
              ))}
            </div>
            <div className="dashboard-plot">
              {rows.map((row) => {
                const height = `${(row.hours / maxHours) * 100}%`;
                const className = row.hours > 8 ? "dashboard-bar danger" : row.hours < 8 ? "dashboard-bar warning" : "dashboard-bar ok";
                return (
                  <div className="dashboard-bar-track" key={row.date}>
                    <div className={className} style={{ "--bar-height": height } as React.CSSProperties} />
                  </div>
                );
              })}
            </div>
            <div className="dashboard-labels">
              {rows.map((row) => <span className="bar-label" key={row.date}>{row.label}</span>)}
            </div>
          </>
        ) : (
          <p className="muted">No hay horas registradas para ese recurso en el mes seleccionado.</p>
        )}
      </div>
    </div>
  );
}

export function DashboardView({
  entries,
  biEntries,
  teams,
  profiles,
  expectedHoursByMonth
}: {
  entries: TimeEntry[];
  biEntries: BiEntry[];
  teams: Team[];
  profiles: Profile[];
  expectedHoursByMonth: ExpectedHoursByMonth[];
}) {
  const [dashboardTab, setDashboardTab] = useState<"mensual" | "diario">("mensual");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [teamId, setTeamId] = useState("Todos");
  const [dailyArea, setDailyArea] = useState<"Aplicaciones" | "BI">("Aplicaciones");
  const [dailyResource, setDailyResource] = useState("");
  const expectedHours = expectedHoursByMonth.find((item) => item.month === month)?.expected_hours ?? 176;
  const activeResources = useMemo(() => {
    return new Set(
      profiles
        .filter((profile) => profile.active && profile.resource_name)
        .map((profile) => profile.resource_name as string)
    );
  }, [profiles]);

  function onlyActiveResources(resources: string[]) {
    if (!activeResources.size) return resources;
    return resources.filter((resource) => activeResources.has(resource));
  }

  const selectedTeam = teams.find((team) => team.id === teamId) ?? null;
  const monthEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!entry.fecha_reporte.startsWith(month)) return false;
      if (selectedTeam && !selectedTeam.resources.includes(entry.recurso)) return false;
      return true;
    });
  }, [entries, month, selectedTeam]);

  const appResources = useMemo(() => {
    const resources = selectedTeam ? selectedTeam.resources : Array.from(new Set(teams.flatMap((team) => team.resources)));
    return onlyActiveResources(resources).sort((a, b) => a.localeCompare(b));
  }, [activeResources, selectedTeam, teams]);

  const appRows = useMemo(() => {
    const totals = new Map<string, number>();
    monthEntries.forEach((entry) => {
      totals.set(entry.recurso, (totals.get(entry.recurso) ?? 0) + Number(entry.horas_invertidas));
    });

    return appResources
      .map((resource) => ({ resource, hours: Number((totals.get(resource) ?? 0).toFixed(2)) }))
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.resource.localeCompare(b.resource));
  }, [appResources, monthEntries]);

  const appZeroResources = useMemo(() => {
    const withHours = new Set(appRows.map((row) => row.resource));
    return appResources.filter((resource) => !withHours.has(resource));
  }, [appResources, appRows]);

  const biRows = useMemo(() => {
    const totals = new Map<string, number>();
    biEntries
      .filter((entry) => entry.fecha_inicio.startsWith(month))
      .forEach((entry) => {
        totals.set(entry.asignado_a, (totals.get(entry.asignado_a) ?? 0) + Number(entry.esfuerzo_horas));
      });
    return Array.from(totals.entries())
      .map(([resource, hours]) => ({ resource, hours: Number(hours.toFixed(2)) }))
      .sort((a, b) => b.hours - a.hours || a.resource.localeCompare(b.resource));
  }, [biEntries, month]);

  const biResources = useMemo(() => {
    return onlyActiveResources(Array.from(new Set(biEntries.map((entry) => entry.asignado_a)))).sort((a, b) => a.localeCompare(b));
  }, [activeResources, biEntries]);

  const biZeroResources = useMemo(() => {
    const withHours = new Set(biRows.map((row) => row.resource));
    return biResources.filter((resource) => !withHours.has(resource));
  }, [biResources, biRows]);

  const dailyResourceOptions = dailyArea === "Aplicaciones" ? appResources : biResources;

  useEffect(() => {
    if (dailyResourceOptions.length === 0) {
      setDailyResource("");
      return;
    }
    if (!dailyResourceOptions.includes(dailyResource)) {
      setDailyResource(dailyResourceOptions[0]);
    }
  }, [dailyResource, dailyResourceOptions]);

  const dailyRows = useMemo(() => {
    const totals = new Map<string, number>();

    if (!dailyResource) return [];

    if (dailyArea === "Aplicaciones") {
      entries
        .filter((entry) => entry.fecha_reporte.startsWith(month) && entry.recurso === dailyResource)
        .forEach((entry) => {
          totals.set(entry.fecha_reporte, (totals.get(entry.fecha_reporte) ?? 0) + Number(entry.horas_invertidas));
        });
    } else {
      biEntries
        .filter((entry) => entry.fecha_inicio.startsWith(month) && entry.asignado_a === dailyResource)
        .forEach((entry) => {
          totals.set(entry.fecha_inicio, (totals.get(entry.fecha_inicio) ?? 0) + Number(entry.esfuerzo_horas));
        });
    }

    return Array.from(totals.entries())
      .map(([date, hours]) => ({
        date,
        label: date.slice(8, 10),
        hours: Number(hours.toFixed(2))
      }))
      .filter((row) => row.hours > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [biEntries, dailyArea, dailyResource, entries, month]);

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Horas registradas por recurso durante el mes seleccionado.</p>
        </div>
      </div>

      <div className="segmented">
        <button className={dashboardTab === "mensual" ? "active" : ""} type="button" onClick={() => setDashboardTab("mensual")}>
          Reporte Mensual
        </button>
        <button className={dashboardTab === "diario" ? "active" : ""} type="button" onClick={() => setDashboardTab("diario")}>
          Detalle Diario por Recurso
        </button>
      </div>

      {dashboardTab === "mensual" && (
        <>
          <div className="card grid">
            <div className="grid grid-3 filters">
              <label>
                Mes
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </label>
              <label>
                Equipo
                <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                  <option value="Todos">Todos</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Horas esperadas
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={expectedHours}
                  readOnly
                />
              </label>
            </div>
          </div>

          <HoursChart
            title={`Aplicaciones - Total de HH registradas${selectedTeam ? ` - ${selectedTeam.name}` : ""}`}
            subtitle={`Horas esperadas para el mes: ${expectedHours} hh por recurso.`}
            rows={appRows}
            expectedHours={expectedHours}
            zeroResources={appZeroResources}
          />

          <HoursChart
            title="BI - Total de HH registradas"
            subtitle={`Horas esperadas para el mes: ${expectedHours} hh por recurso.`}
            rows={biRows}
            expectedHours={expectedHours}
            zeroResources={biZeroResources}
          />
        </>
      )}

      {dashboardTab === "diario" && (
        <>
          <div className="card grid">
            <div className="grid grid-3 filters">
              <label>
                Mes
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </label>
              <label>
                Area
                <select value={dailyArea} onChange={(event) => setDailyArea(event.target.value as "Aplicaciones" | "BI")}>
                  <option>Aplicaciones</option>
                  <option>BI</option>
                </select>
              </label>
              <label>
                Recurso
                <select value={dailyResource} onChange={(event) => setDailyResource(event.target.value)}>
                  {dailyResourceOptions.map((resource) => (
                    <option key={resource} value={resource}>{resource}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <DailyHoursChart
            title={`${dailyArea} - Horas por dia`}
            rows={dailyRows}
            resource={dailyResource}
            month={month}
          />
        </>
      )}
    </section>
  );
}
