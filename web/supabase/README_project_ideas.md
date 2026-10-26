# Ideas de Proyecto

## Activacion

1. Ejecutar `add_project_ideas.sql` completo en Supabase SQL Editor. Requiere los equipos y el flujo simplificado de Aplicaciones. No ejecutar nuevamente `schema.sql` sobre la BD existente.
2. En Administracion > Equipos, agregar a los usuarios como miembros, marcar los lideres y guardar. Los lideres deben ser cuentas activas de Aplicaciones.
3. En Administracion > Usuarios, crear o asignar el rol `consulta_proyectos` a las cuentas que gestionaran el seguimiento administrativo. No requieren recurso.
4. Estas cuentas ingresan directamente a Ideas de Proyecto. Tambien pueden entrar por `/ideas-proyecto`.
5. Para instalaciones existentes, ejecutar `improve_project_ideas.sql` actualizado. Incluye las columnas de edicion anteriores, lectura por equipo para lideres, los cuatro campos de seguimiento y el estado Observada. Restaura los permisos completos de edicion sin habilitar cambios en correlativo ni ticket. No elimina datos ni cambia tickets.

## Funcionamiento

- Solo los lideres asignados pueden crear Anteproyecto - Planificacion. Deben completar Alcance Proyecto y Titulo de Correo, ademas de los datos habituales del ticket.
- Se guardan ticket, idea y responsables en una transaccion. La secuencia genera IDEA0001, IDEA0002, etc. Un intento fallido puede dejar saltos en la numeracion.
- Los datos iniciales se leen del ticket. Al editar la idea se guardan sus propios valores de alcance, titulo, sociedad, solicitante y responsables. Esas correcciones no modifican el ticket original. El alcance del proyecto es un campo distinto del alcance habitual de la atencion.
- HH estimacion y costo nacen vacios. El costo es en soles (PEN). Las fechas del proyecto nacen vacias y son independientes de las fechas del ticket.
- Cantidad HH reales es editable, nace vacio y admite cero o valores positivos con hasta dos decimales. Se ingresa manualmente en la idea y se incluye en el CSV. Para instalaciones existentes, ejecutar `add_project_idea_actual_hours.sql`.
- Estado inicial de cotizacion: Por entregar. Estado inicial de atencion: Por aprobar cotizacion.
- `consulta_proyectos` y `administracion` pueden consultar, filtrar, descargar y editar todos los campos de la idea excepto correlativo y ticket vinculado.
- Los lideres activos de Aplicaciones pueden consultar, filtrar y descargar las ideas de su mismo equipo, sin editar. La pertenencia se consulta con los miembros del equipo del creador del ticket; cambiar responsables de la idea no cambia su visibilidad. Si lideran varios equipos activos, ven la union de sus ideas. No ven ideas de otros equipos.
- Fecha envio estimacion y Fecha envio cotizacion nacen vacias. Proveedor externo y Prioridad nacen en No y son editables por los gestores. El estado de cotizacion admite tambien Observada. Todos estos campos se incluyen en el listado y en el CSV.
- Si ya se ejecuto una version anterior de la migracion, ejecutar `edit_project_ideas.sql` para agregar los campos propios y habilitar la edicion completa. No altera los datos de los tickets ni reinicia correlativos.
- El listado permite buscar, filtrar, refrescar y exportar a CSV las filas filtradas, con todos sus campos.
- Los tickets historicos no generan ideas automaticamente al ejecutar la migracion. Eliminar fisicamente un ticket con idea esta restringido para conservar su referencia.

## Verificacion Local

`npm run test:project-ideas` prueba la migracion contra PostgreSQL en memoria (PGlite), sin conectarse a Supabase. Verifica liderazgo, campos obligatorios, atomicidad, correlativos, permisos de edicion y aislamiento del nuevo rol.

## Permisos Despues de Migraciones Anteriores

Una version antigua de `edit_project_ideas.sql`, ejecutada despues de `improve_project_ideas.sql`, retiraba los permisos de actualizacion de las cuatro columnas nuevas. Esto producia `permission denied for table project_ideas` al guardar. Ejecutar `improve_project_ideas.sql` actualizado restaura la lista completa de permisos. Ambos scripts actualizados preservan los permisos al repetirse en cualquier orden.
