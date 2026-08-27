const guideRows = [
  {
    type: "Proyecto",
    description:
      'Atencion nueva que requiere estimacion de tiempos y costos adicionales, y cuenta con un cronograma de trabajo con fechas de inicio y fin. Las capacitaciones necesarias deben incluirse dentro del proyecto; cada etapa del proyecto se debe realizar creando un ticket. Ejemplo: "Proyecto - Analisis", "Proyecto - Desarrollo".'
  },
  {
    type: "Requerimiento - Evolutivo/Correctivo",
    description:
      "Cambio, mejora o correccion de una funcionalidad existente. Si se atiende utilizando las horas de soporte disponibles, debe registrarse como Requerimiento - Evolutivo/Correctivo. Las capacitaciones asociadas deben formar parte de la misma atencion."
  },
  {
    type: "Incidencia",
    description:
      "Evento no planificado que interrumpe el funcionamiento normal de un servicio o reduce su calidad. Corresponde cuando algo que funcionaba correctamente deja de funcionar."
  },
  {
    type: "Soporte",
    description:
      "Asistencia sobre funcionalidades existentes que no requiere desarrollar una mejora o correccion. Incluye consultas, orientacion y capacitaciones sobre soluciones antiguas."
  },
  {
    type: "Soporte - Revision y analisis de casuisticas",
    description:
      "Revisiones de interfaz, clasificacion de incidentes, validaciones de logica y analisis de casos especificos. Debe registrarse dentro de Soporte con esta clasificacion."
  }
];

const rules = [
  "Una capacitacion sobre una solucion antigua se registra como Soporte - Capacitacion.",
  "Una capacitacion relacionada con un proyecto o requerimiento nuevo debe incluirse dentro de esa misma atencion; no debe crearse como un ticket adicional de soporte.",
  "Si requiere una estimacion independiente de tiempo y costos, se registra como Anteproyecto.",
  "Si existe una falla inesperada en algo que anteriormente funcionaba, se registra como Incidencia."
];

export function AttentionGuideView() {
  return (
    <section className="grid">
      <div className="section-head">
        <div>
          <h2>Guia de Atenciones</h2>
          <p className="muted">Criterios para clasificar y crear tickets de Aplicaciones correctamente.</p>
        </div>
      </div>

      <div className="card guide-card">
        <div className="guide-intro">
          <h3>Cuando corresponde cada tipo</h3>
          <p className="muted">Usa esta referencia antes de crear un ticket para evitar duplicidades o clasificaciones incorrectas.</p>
        </div>

        <div className="guide-table">
          <div className="guide-row guide-header">
            <span>Tipo</span>
            <span>Cuando corresponde?</span>
          </div>
          {guideRows.map((row) => (
            <div className="guide-row" key={row.type}>
              <strong>{row.type}</strong>
              <p>{row.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card guide-rules-card">
        <h3>Reglas importantes</h3>
        <ul>
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
