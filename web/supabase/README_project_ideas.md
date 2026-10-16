# Ideas de Proyecto

## Activacion

1. Ejecutar `add_project_ideas.sql` completo en Supabase SQL Editor. Requiere los equipos y el flujo simplificado de Aplicaciones. No ejecutar nuevamente `schema.sql` sobre la BD existente.
2. En Administracion > Equipos, agregar a los usuarios como miembros, marcar los lideres y guardar. Los lideres deben ser cuentas activas de Aplicaciones.
3. En Administracion > Usuarios, crear o asignar el rol `consulta_proyectos` a las cuentas que gestionaran el seguimiento administrativo. No requieren recurso.
4. Estas cuentas ingresan directamente a Ideas de Proyecto. Tambien pueden entrar por `/ideas-proyecto`.

## Funcionamiento

- Solo los lideres asignados pueden crear Anteproyecto - Planificacion. Deben completar Alcance Proyecto y Titulo de Correo, ademas de los datos habituales del ticket.
- Se guardan ticket, idea y responsables en una transaccion. La secuencia genera IDEA0001, IDEA0002, etc. Un intento fallido puede dejar saltos en la numeracion.
- Los datos iniciales se leen del ticket. Al editar la idea se guardan sus propios valores de alcance, titulo, sociedad, solicitante y responsables. Esas correcciones no modifican el ticket original. El alcance del proyecto es un campo distinto del alcance habitual de la atencion.
- HH estimacion y costo nacen vacios. El costo es en soles (PEN). Las fechas del proyecto nacen vacias y son independientes de las fechas del ticket.
- Estado inicial de cotizacion: Por entregar. Estado inicial de atencion: Por aprobar cotizacion.
- `consulta_proyectos` y `administracion` pueden consultar, filtrar, descargar y editar todos los campos de la idea excepto correlativo y ticket vinculado. Los lideres conservan sus accesos habituales.
- Si ya se ejecuto una version anterior de la migracion, ejecutar `edit_project_ideas.sql` para agregar los campos propios y habilitar la edicion completa. No altera los datos de los tickets ni reinicia correlativos.
- El listado permite buscar, filtrar, refrescar y exportar a CSV las filas filtradas, con todos sus campos.
- Los tickets historicos no generan ideas automaticamente al ejecutar la migracion. Eliminar fisicamente un ticket con idea esta restringido para conservar su referencia.

## Verificacion Local

`npm run test:project-ideas` prueba la migracion contra PostgreSQL en memoria (PGlite), sin conectarse a Supabase. Verifica liderazgo, campos obligatorios, atomicidad, correlativos, permisos de edicion y aislamiento del nuevo rol.
