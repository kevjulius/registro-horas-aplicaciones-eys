"use client";

import { useMemo, useState } from "react";
import { today } from "@/components/app-shared";
import type { BiEntry, Team, TimeEntry } from "@/lib/types";

type ChartRow = {
  resource: string;
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
  const chartTrackTop = 70;
  const chartTrackHeight = 220;
  const expectedRatio = Math.max(0, Math.min(1, expectedHours / maxHours));
  const expectedLineTop = `${chartTrackTop + (1 - expectedRatio) * chartTrackHeight}px`;
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);
  const belowExpected = rows.filter((row) => row.hours < expectedHours).length;

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
        <div className="dashboard-chart" style={{ "--expected-top": expectedLineTop } as React.CSSProperties}>
          <div className="expected-line">
            <span>{expectedHours}</span>
          </div>
          {rows.map((row) => {
            const height = `${(row.hours / maxHours) * 100}%`;
            return (
              <div className="dashboard-bar-item" key={row.resource}>
                <span className="bar-value">{row.hours}</span>
                <div className="dashboard-bar-track">
                  <div
                    className={row.hours >= expectedHours ? "dashboard-bar ok" : "dashboard-bar"}
                    style={{ "--bar-height": height } as React.CSSProperties}
                  />
                </div>
                <span className="bar-label">{row.resource}</span>
              </div>
            );
          })}
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

export function DashboardView({ entries, biEntries, teams }: { entries: TimeEntry[]; biEntries: BiEntry[]; teams: Team[] }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [teamId, setTeamId] = useState("Todos");
  const [expectedHours, setExpectedHours] = useState(176);

  const selectedTeam = teams.find((team) => team.id === teamId) ?? null;
  const monthEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!entry.fecha_reporte.startsWith(month)) return false;
      if (selectedTeam && !selectedTeam.resources.includes(entry.recurso)) return false;
      return true;
    });
  }, [entries, month, selectedTeam]);

  const appResources = useMemo(() => {
    if (selectedTeam) return selectedTeam.resources;
    return Array.from(new Set(teams.flatMap((team) => team.resources))).sort((a, b) => a.localeCompare(b));
  }, [selectedTeam, teams]);

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
    return Array.from(new Set(biEntries.map((entry) => entry.asignado_a))).sort((a, b) => a.localeCompare(b));
  }, [biEntries]);

  const biZeroResources = useMemo(() => {
    const withHours = new Set(biRows.map((row) => row.resource));
    return biResources.filter((resource) => !withHours.has(resource));
  }, [biResources, biRows]);

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Horas registradas por recurso durante el mes seleccionado.</p>
        </div>
      </div>

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
              onChange={(event) => setExpectedHours(Number(event.target.value))}
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
    </section>
  );
}
