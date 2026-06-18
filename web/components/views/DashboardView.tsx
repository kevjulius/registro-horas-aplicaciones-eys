"use client";

import { useMemo, useState } from "react";
import { today } from "@/components/app-shared";
import type { Team, TimeEntry } from "@/lib/types";

export function DashboardView({ entries, teams }: { entries: TimeEntry[]; teams: Team[] }) {
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

  const chartRows = useMemo(() => {
    const totals = new Map<string, number>();
    monthEntries.forEach((entry) => {
      totals.set(entry.recurso, (totals.get(entry.recurso) ?? 0) + Number(entry.horas_invertidas));
    });

    const resources = selectedTeam
      ? selectedTeam.resources
      : Array.from(totals.keys()).sort((a, b) => a.localeCompare(b));

    return resources
      .map((resource) => ({ resource, hours: Number((totals.get(resource) ?? 0).toFixed(2)) }))
      .sort((a, b) => b.hours - a.hours || a.resource.localeCompare(b.resource));
  }, [monthEntries, selectedTeam]);

  const maxHours = Math.max(expectedHours, ...chartRows.map((row) => row.hours), 1);
  const chartTrackTop = 78;
  const chartTrackHeight = 220;
  const expectedRatio = Math.max(0, Math.min(1, expectedHours / maxHours));
  const expectedLineTop = `${chartTrackTop + (1 - expectedRatio) * chartTrackHeight}px`;
  const totalHours = chartRows.reduce((sum, row) => sum + row.hours, 0);
  const belowExpected = chartRows.filter((row) => row.hours < expectedHours).length;

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Horas registradas por recurso durante el mes seleccionado.</p>
        </div>
        <div className="toolbar">
          <span className="pill">Recursos: {chartRows.length}</span>
          <span className="pill muted-pill">Horas: {Number(totalHours.toFixed(2))}</span>
          <span className="pill muted-pill">Debajo esperado: {belowExpected}</span>
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

      <div className="card dashboard-card">
        <div className="section-head compact">
          <div>
            <h3>Total de HH registradas {selectedTeam ? `- ${selectedTeam.name}` : ""}</h3>
            <p className="muted">Horas esperadas para el mes: {expectedHours} hh por recurso.</p>
          </div>
        </div>
        <div className="dashboard-chart" style={{ "--expected-top": expectedLineTop } as React.CSSProperties}>
          <div className="expected-line">
            <span>{expectedHours}</span>
          </div>
          {chartRows.map((row) => {
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
          {chartRows.length === 0 && <p className="muted">No hay horas registradas para esos filtros.</p>}
        </div>
      </div>
    </section>
  );
}
