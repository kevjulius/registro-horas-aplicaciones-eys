"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveBiMasters } from "@/lib/repository";
import type { BiMasterData } from "@/lib/types";

type BiMasterKey = "servicios" | "atenciones" | "estados" | "formatos";

const masterLabels: Record<BiMasterKey, string> = {
  servicios: "Servicios",
  atenciones: "Atenciones",
  estados: "Estados",
  formatos: "Formatos"
};

export function AdminBiView({ masters, onChanged }: { masters: BiMasterData; onChanged: () => void }) {
  const [localMasters, setLocalMasters] = useState(masters);
  const [masterKey, setMasterKey] = useState<BiMasterKey>("servicios");
  const [newValue, setNewValue] = useState("");
  const [newAttention, setNewAttention] = useState({ name: "", code: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLocalMasters(masters);
  }, [masters]);

  async function persist(updated = localMasters, successMessage = "Maestras BI guardadas.") {
    try {
      const saved = await saveBiMasters(updated);
      setLocalMasters(saved);
      setMessage(successMessage);
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar maestras BI.");
    }
  }

  async function addValue() {
    if (masterKey === "atenciones") {
      if (!newAttention.name.trim() || !newAttention.code.trim()) return;
      const next = {
        ...localMasters,
        atenciones: [...localMasters.atenciones, { name: newAttention.name.trim(), code: newAttention.code.trim().toUpperCase() }]
          .sort((a, b) => a.name.localeCompare(b.name))
      };
      setNewAttention({ name: "", code: "" });
      await persist(next, "Atencion BI agregada.");
      return;
    }
    if (!newValue.trim()) return;
    const next = { ...localMasters, [masterKey]: [...localMasters[masterKey], newValue.trim()].sort() };
    setNewValue("");
    await persist(next, "Valor BI agregado.");
  }

  function removeValue(index: number) {
    const next = masterKey === "atenciones"
      ? { ...localMasters, atenciones: localMasters.atenciones.filter((_, itemIndex) => itemIndex !== index) }
      : { ...localMasters, [masterKey]: localMasters[masterKey].filter((_, itemIndex) => itemIndex !== index) };
    setLocalMasters(next);
  }

  function updateValue(index: number, value: string) {
    if (masterKey === "atenciones") {
      const next = [...localMasters.atenciones];
      next[index] = { ...next[index], name: value };
      setLocalMasters({ ...localMasters, atenciones: next });
      return;
    }
    const next = [...localMasters[masterKey]];
    next[index] = value;
    setLocalMasters({ ...localMasters, [masterKey]: next });
  }

  function updateAttentionCode(index: number, value: string) {
    const next = [...localMasters.atenciones];
    next[index] = { ...next[index], code: value.toUpperCase() };
    setLocalMasters({ ...localMasters, atenciones: next });
  }

  const values = masterKey === "atenciones" ? localMasters.atenciones : localMasters[masterKey];

  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Administracion BI</h2>
          <p className="muted">Gestiona las maestras propias del flujo BI.</p>
        </div>
      </div>

      <div className="admin-layout">
        <div className="card grid">
          <h3>Selecciona una tabla</h3>
          <div className="master-list">
            {(Object.keys(masterLabels) as BiMasterKey[]).map((key) => (
              <button key={key} className={masterKey === key ? "active" : ""} type="button" onClick={() => { setMessage(""); setMasterKey(key); }}>
                <span>{masterLabels[key]}</span>
                <small>{key === "atenciones" ? localMasters.atenciones.length : localMasters[key].length}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="card grid">
          <div className="section-head compact">
            <h3>{masterLabels[masterKey]}</h3>
            <span className="pill">{values.length} valores</span>
          </div>

          {masterKey === "atenciones" ? (
            <div className="grid grid-3">
              <label>
                Atencion
                <input value={newAttention.name} onChange={(event) => setNewAttention({ ...newAttention, name: event.target.value })} placeholder="Soporte" />
              </label>
              <label>
                Codigo
                <input value={newAttention.code} onChange={(event) => setNewAttention({ ...newAttention, code: event.target.value.toUpperCase() })} placeholder="SOP" />
              </label>
              <button type="button" onClick={addValue}><Plus size={16} /> Agregar</button>
            </div>
          ) : (
            <div className="inline-form">
              <input value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder="Nuevo valor" />
              <button type="button" onClick={addValue}><Plus size={16} /> Agregar</button>
            </div>
          )}

          <div className="grid">
            {masterKey === "atenciones"
              ? localMasters.atenciones.map((item, index) => (
                  <div className="master-row" key={`${item.name}-${index}`}>
                    <input value={item.name} onChange={(event) => updateValue(index, event.target.value)} />
                    <input value={item.code} onChange={(event) => updateAttentionCode(index, event.target.value)} />
                    <button className="secondary icon-button" type="button" onClick={() => removeValue(index)}><Trash2 size={16} /></button>
                  </div>
                ))
              : (localMasters[masterKey] as string[]).map((item, index) => (
                  <div className="master-row" key={`${item}-${index}`}>
                    <input value={item} onChange={(event) => updateValue(index, event.target.value)} />
                    <button className="secondary icon-button" type="button" onClick={() => removeValue(index)}><Trash2 size={16} /></button>
                  </div>
                ))}
          </div>

          {message && <pre className="notice">{message}</pre>}
          <button type="button" onClick={() => persist()}>Guardar maestras BI</button>
        </div>
      </div>
    </section>
  );
}
