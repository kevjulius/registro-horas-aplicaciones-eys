import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const require = createRequire(import.meta.url);
function loadTs(path, modules = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, (name) => modules[name] ?? require(name));
  return module.exports;
}
const { cleanProjectIdeaUpdate, isProjectPlanning } = loadTs("../lib/project-ideas.ts");
const values = { alcance_proyecto: "Alcance corregido", titulo_correo: "Titulo corregido", sociedad: "A125",
  usuario_solicitante: "Otro solicitante SPSA", responsables: ["Worker"],
  horas_estimacion: null, horas_reales: null, costo_cotizacion: null, estado_cotizacion: "Por entregar",
  fecha_envio_estimacion: null, fecha_envio_cotizacion: null, proveedor_externo: false, prioridad: false,
  fecha_inicio: null, fecha_fin: null, estado_atencion: "Por aprobar cotizacion", bloqueantes: "" };
assert(isProjectPlanning({ tipo_atencion: "Anteproyecto", subcategoria_atencion: " Planificaci\u00f3n " }));
assert(!isProjectPlanning({ tipo_atencion: "Proyecto", subcategoria_atencion: "Planificacion" }));
assert.deepEqual(cleanProjectIdeaUpdate(values), values);
assert.equal(cleanProjectIdeaUpdate({ ...values, costo_cotizacion: 123.45 }).costo_cotizacion, 123.45);
assert.equal(cleanProjectIdeaUpdate({ ...values, horas_reales: 12.75 }).horas_reales, 12.75);
assert.equal(cleanProjectIdeaUpdate({ ...values, horas_reales: 0 }).horas_reales, 0);
assert.equal(cleanProjectIdeaUpdate({ ...values, horas_reales: "" }).horas_reales, null);
assert.equal(cleanProjectIdeaUpdate({ ...values, estado_cotizacion: "Observada" }).estado_cotizacion, "Observada");
assert.equal(cleanProjectIdeaUpdate({ ...values, fecha_envio_estimacion: "2026-10-20" }).fecha_envio_estimacion, "2026-10-20");
assert.equal(cleanProjectIdeaUpdate({ ...values, proveedor_externo: true, prioridad: true }).prioridad, true);
for (const patch of [{ costo_cotizacion: -1 }, { horas_estimacion: "4" }, { horas_estimacion: Infinity },
  { fecha_inicio: "2026-02-30" }, { fecha_inicio: "2026-10-20", fecha_fin: "2026-10-19" }, { estado_cotizacion: "Cerrado" },
  { alcance_proyecto: " " }, { titulo_correo: "" }, { sociedad: " " }, { usuario_solicitante: null }, { responsables: [] }, { responsables: [" "] },
  { horas_reales: -1 }, { horas_reales: Infinity }, { horas_reales: "12.75" },
  { fecha_envio_estimacion: "2026-02-30" }, { fecha_envio_cotizacion: "ayer" },
  { proveedor_externo: "No" }, { prioridad: 1 }, { proveedor_externo: null }]) {
  assert.throws(() => cleanProjectIdeaUpdate({ ...values, ...patch }));
}
assert(!("ticket_id" in cleanProjectIdeaUpdate({ ...values, ticket_id: "changed" })));
assert(!("correlativo" in cleanProjectIdeaUpdate({ ...values, correlativo: "IDEA9999" })));

// Exercise the API's service-role enrichment without letting it bypass the RLS allowlist.
const previousEnv = Object.fromEntries(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].map(key => [key, process.env[key]]));
Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "http://fixture.local", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service" });
let apiRole = "trabajador_aplicaciones", apiActive = true, apiLeader = true;
let apiVisible = [], apiPages = [], apiUpdates = [];
let apiUpdateError = null;
const apiRow = id => ({ id, ticket_id: "ticket", correlativo: `IDEA${id}`, ...values,
  tickets: { codigo_tck: "ANT260001", alcance_proyecto: "Original", subject_correo: "Titulo", formato: "Todos",
    usuario_solicitante: "SPSA", ticket_responsables: [{ resource_name: "Leader" }] } });
function apiClient(key) {
  const service = key === "service";
  return {
    auth: { getUser: async () => ({ data: { user: { id: "actor" } } }) },
    rpc: async () => ({ data: apiLeader }),
    from(table) {
      let ids, update, range;
      const query = {
        select() { return query; }, order() { return query; }, eq() { return query; },
        in(column, allowed) { assert.equal(column, "id"); ids = allowed; return query; },
        range(from, to) { range = [from, to]; return query; },
        update(values) { assert(!service); update = values; return query; },
        single() { return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (table === "profiles") return { data: { role: apiRole, active: apiActive } };
            if (table !== "project_ideas") {
              assert(service && ["consulta_proyectos", "administracion"].includes(apiRole), "Readonly leaders must not load global edit catalogs");
              return { data: [] };
            }
            if (update) {
              if (apiUpdateError) return { error: apiUpdateError };
              apiUpdates.push(update); return { data: { id: "saved" } };
            }
            if (!service) {
              assert(range, "Authorization must be paginated before enrichment");
              return { data: apiVisible.slice(range[0], range[1] + 1).map(id => ({ id })) };
            }
            assert(ids?.length, "Service-role reads must always filter by authorized idea IDs");
            apiPages.push(ids);
            return { data: ids.map(apiRow) };
          }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}
try {
  const route = loadTs("../app/api/project-ideas/route.ts", {
    "@supabase/supabase-js": { createClient: (_url, key) => apiClient(key) },
    "@/lib/project-ideas": { cleanProjectIdeaUpdate }
  });
  const request = method => new Request("http://fixture.local/api/project-ideas", {
    method, headers: { authorization: "Bearer fixture", "content-type": "application/json" },
    ...(method === "PATCH" ? { body: JSON.stringify({ id: "20000000-0000-4000-8000-000000000001", ...values }) } : {})
  });
  apiVisible = Array.from({ length: 501 }, (_, i) => `visible-${i}`);
  const response = await route.GET(request("GET"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).ideas.map(idea => idea.id), apiVisible);
  assert.deepEqual(apiPages.map(page => page.length), [500, 1]);
  assert.equal((await route.PATCH(request("PATCH"))).status, 403);
  assert.equal(apiUpdates.length, 0);
  apiVisible = []; apiPages = [];
  assert.deepEqual((await (await route.GET(request("GET"))).json()).ideas, []);
  assert.equal(apiPages.length, 0);
  apiLeader = false;
  assert.equal((await route.GET(request("GET"))).status, 403);
  apiRole = "administracion";
  assert.equal((await route.PATCH(request("PATCH"))).status, 200);
  assert.deepEqual(apiUpdates[0], values);
  for (const [code, message, expected] of [
    ["42501", "permission denied for table project_ideas", "Faltan permisos"],
    ["42703", "column project_ideas.alcance_proyecto does not exist", "Faltan columnas"],
    ["PGRST204", "Could not find the alcance_proyecto column in the schema cache", "Faltan columnas"]
  ]) {
    apiUpdateError = { code, message };
    const failed = await route.PATCH(request("PATCH"));
    assert.equal(failed.status, 400);
    const { error } = await failed.json();
    assert(error.includes(expected) && error.includes(message) && error.includes("improve_project_ideas.sql actualizado"));
  }
  apiUpdateError = null;
  apiActive = false;
  assert.equal((await route.GET(request("GET"))).status, 403);
  assert.equal((await route.PATCH(request("PATCH"))).status, 403);
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

const db = new PGlite();
const ids = { admin: "00000000-0000-4000-8000-000000000001", leader: "00000000-0000-4000-8000-000000000002",
  worker: "00000000-0000-4000-8000-000000000003", manager: "00000000-0000-4000-8000-000000000004",
  inactive: "00000000-0000-4000-8000-000000000005", bi: "00000000-0000-4000-8000-000000000006" };
const teamId = "10000000-0000-4000-8000-000000000001";
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema public, auth to authenticated, service_role;
    grant execute on function auth.uid() to authenticated, service_role;
  `);
  await db.exec(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
  await db.exec(`
    alter table public.profile_teams drop column is_leader;
    alter table public.tickets drop column alcance_proyecto;
    alter table public.profiles drop constraint profiles_role_check;
    alter table public.profiles add constraint profiles_role_check
      check (role in ('trabajador', 'trabajador_aplicaciones', 'trabajador_bi', 'adminbi', 'administracion'));
  `);
  for (const [name, id] of Object.entries(ids)) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query("insert into public.profiles(id, email, display_name, role, resource_name, active) values ($1,$2,$3,$4,$5,$6)",
      [id, `${name}@test.local`, name, name === "admin" ? "administracion" : name === "bi" ? "trabajador_bi" : "trabajador_aplicaciones", "Leader", name !== "inactive"]);
  }
  await db.query("insert into public.teams(id, name) values ($1, 'Aplicaciones')", [teamId]);
  await db.query("insert into public.profile_teams(profile_id, team_id) select id, $1::uuid from public.profiles", [teamId]);
  await db.exec("insert into public.resources(name) values ('Leader'), ('Worker');");
  const ticket = { codigo_tck: "ANT260001", fecha_solicitud: "2026-10-16", sistema: "Sistema A",
    formato: "A124 | A125", usuario_solicitante: "Solicitante SPSA", fecha_recepcion: "2026-10-16",
    subject_correo: "Solicitud de nuevo proyecto", alcance_correo: "Planificar el proyecto",
    alcance_proyecto: "Integrar dos sistemas", tipo_atencion: "Anteproyecto", subcategoria_atencion: "Planificaci\u00f3n",
    estado: "En Proceso", fecha_termino: "2026-10-20", en_servicio: "No", aplicativo_se_encuentra: "Si" };
  await db.query(`insert into public.tickets(codigo_tck, fecha_solicitud, sistema, formato, usuario_solicitante,
    fecha_recepcion, subject_correo, alcance_correo, tipo_atencion, subcategoria_atencion, estado, fecha_termino, tipo_tck, requested_by)
    values ('ANT-HISTORICO', '2026-01-01', 'Sistema A', 'Todos', 'SPSA', '2026-01-01', 'Historico', 'Alcance',
      'Anteproyecto', 'Planificacion', 'Cerrado', '2026-01-01', 'Personal', $1)`, [ids.worker]);

  const migration = readFileSync(new URL("../supabase/add_project_ideas.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.exec(migration);
  assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 0, "Migration must not create historical ideas");
  await db.query("update public.profiles set role='consulta_proyectos' where id=$1", [ids.manager]);
  await db.query("update public.profile_teams set is_leader=true where profile_id in ($1,$2,$3)", [ids.leader, ids.inactive, ids.bi]);
  assert.equal((await db.query("select count(*)::int n from attention_types where active and public.is_project_planning(type,classification)")).rows[0].n, 1);

  async function create(row = ticket, creator = ids.leader, resources = ["Leader", "Worker"]) {
    return db.query("select public.create_project_planning_ticket($1::jsonb, $2::text[], $3::uuid) id", [JSON.stringify(row), resources, creator]);
  }
  for (const actor of [ids.worker, ids.admin, ids.inactive, ids.bi, ids.manager]) {
    await assert.rejects(create(ticket, actor), /Solo los lideres/);
  }
  await db.exec("update teams set active=false");
  await assert.rejects(create(), /Solo los lideres/);
  await db.exec("update teams set active=true");
  await assert.rejects(create({ ...ticket, subject_correo: " " }), /obligatorios/);
  await assert.rejects(create({ ...ticket, alcance_proyecto: " " }), /obligatorios/);
  await assert.rejects(create(ticket, ids.leader, []), /responsable/);
  await assert.rejects(create(ticket, ids.leader, ["No existe"]), /foreign key/);
  assert.equal((await db.query("select count(*)::int n from tickets where codigo_tck='ANT260001'")).rows[0].n, 0, "Failed links must roll back ticket");
  assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 0, "Failed links must roll back idea");
  const created = await create();
  const ticketId = created.rows[0].id;
  const idea = (await db.query("select * from project_ideas where ticket_id=$1", [ticketId])).rows[0];
  assert.match(idea.correlativo, /^IDEA\d{4,}$/);
  assert.equal(idea.fecha_inicio, null);
  assert.equal(idea.fecha_fin, null);
  assert.equal(idea.horas_estimacion, null);
  assert.equal(idea.horas_reales, null);
  assert.equal(idea.costo_cotizacion, null);
  assert.equal(idea.estado_cotizacion, "Por entregar");
  assert.equal(idea.fecha_envio_estimacion, null);
  assert.equal(idea.fecha_envio_cotizacion, null);
  assert.equal(idea.proveedor_externo, false);
  assert.equal(idea.prioridad, false);
  assert.equal((await db.query("select count(*)::int n from ticket_responsables where ticket_id=$1", [ticketId])).rows[0].n, 2);
  await db.query("update tickets set fecha_termino='2026-10-21' where id=$1", [ticketId]);
  assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1, "Editing must not duplicate idea");
  await assert.rejects(db.query("update tickets set alcance_proyecto='' where id=$1", [ticketId]), /obligatorios/);
  await assert.rejects(db.query("update tickets set tipo_atencion='Proyecto' where id=$1", [ticketId]), /conservar/);
  await db.exec("grant select, insert, update, delete on all tables in schema public to authenticated;");
  // Simulate upgrading an existing idea from the original read-only metadata model.
  await db.exec(`revoke all on public.project_ideas from authenticated;
    grant select on public.project_ideas to authenticated;
    alter table project_ideas drop column alcance_proyecto, drop column titulo_correo, drop column sociedad,
      drop column usuario_solicitante, drop column responsables;`);
  const editMigration = readFileSync(new URL("../supabase/edit_project_ideas.sql", import.meta.url), "utf8");
  await db.exec(editMigration);
  await db.exec(editMigration);
  await db.exec("alter table project_ideas drop column horas_reales");
  const actualHoursMigration = readFileSync(new URL("../supabase/add_project_idea_actual_hours.sql", import.meta.url), "utf8");
  await db.exec(actualHoursMigration);
  await db.exec(actualHoursMigration);
  assert.equal((await db.query("select horas_reales from project_ideas where id=$1", [idea.id])).rows[0].horas_reales, null);
  assert.equal((await db.query("select ticket_id from project_ideas where id=$1", [idea.id])).rows[0].ticket_id, ticketId);
  // Upgrade an already populated database from before the new tracking fields and leader access.
  await db.exec(`drop policy "project ideas read team leader" on project_ideas;
    drop function public.current_leader_can_read_project_idea(uuid);
    alter table project_ideas drop column fecha_envio_estimacion, drop column fecha_envio_cotizacion,
      drop column proveedor_externo, drop column prioridad,
      drop column alcance_proyecto, drop column titulo_correo, drop column sociedad,
      drop column usuario_solicitante, drop column responsables, drop column horas_reales;
    alter table project_ideas drop constraint project_ideas_estado_cotizacion_check;
    alter table project_ideas add constraint project_ideas_estado_cotizacion_check
      check (estado_cotizacion in ('Por entregar', 'Por aprobar', 'Aprobado'));`);
  const improvements = readFileSync(new URL("../supabase/improve_project_ideas.sql", import.meta.url), "utf8");
  await db.exec(improvements);
  await db.exec(improvements);
  assert.deepEqual((await db.query(`select fecha_envio_estimacion, fecha_envio_cotizacion, proveedor_externo, prioridad
    from project_ideas where id=$1`, [idea.id])).rows[0], {
    fecha_envio_estimacion: null, fecha_envio_cotizacion: null, proveedor_externo: false, prioridad: false
  });
  async function asUser(id, work) {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    try { return await work(); } finally { await db.exec("reset role"); }
  }
  // Reproduce running the old edit migration after improve, then verify the repair.
  await db.exec(`revoke update on project_ideas from authenticated;
    grant update (alcance_proyecto, titulo_correo, sociedad, usuario_solicitante, responsables,
      horas_estimacion, horas_reales, costo_cotizacion, estado_cotizacion, fecha_inicio, fecha_fin, estado_atencion, bloqueantes)
      on project_ideas to authenticated;`);
  await assert.rejects(asUser(ids.manager, () => db.query("update project_ideas set prioridad=true where id=$1", [idea.id])),
    error => error.code === "42501", "Old script order must reproduce the reported permission error");
  await db.exec(improvements);
  const editable = (await db.query(`select column_name from information_schema.columns
    where table_schema='public' and table_name='project_ideas'
      and has_column_privilege('authenticated', 'public.project_ideas', column_name, 'UPDATE')`)).rows.map(row => row.column_name).sort();
  assert.deepEqual(editable, Object.keys(values).sort(), "Grant only the API's editable fields, never the identifiers");
  for (const actor of [ids.worker, ids.bi, ids.inactive]) {
    await asUser(actor, async () => {
      assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 0);
      const updated = await db.query("update project_ideas set costo_cotizacion=900 returning id");
      assert.equal(updated.rows.length, 0, "Workers must not update ideas");
    });
  }
  await asUser(ids.leader, async () => {
    assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1);
    assert.equal((await db.query("update project_ideas set costo_cotizacion=900 returning id")).rows.length, 0);
    assert.equal((await db.query("update project_ideas set prioridad=true returning id")).rows.length, 0);
  });
  await asUser(ids.manager, async () => {
    assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from tickets")).rows[0].n, 0, "Manager must not read raw tickets");
    assert.equal((await db.query("select count(*)::int n from resources")).rows[0].n, 0, "Manager must not read other modules");
    await assert.rejects(db.query("update project_ideas set ticket_id=gen_random_uuid()"), /permission denied/);
    await assert.rejects(db.query("update project_ideas set idea_number=9999"), /permission denied/);
    await assert.rejects(db.query("delete from project_ideas"), /permission denied/);
    await assert.rejects(db.query("select public.create_project_planning_ticket($1::jsonb,$2::text[],$3::uuid)", [JSON.stringify(ticket), ["Leader"], ids.leader]), /permission denied/);
    await assert.rejects(db.query("update project_ideas set horas_reales=-1 where id=$1", [idea.id]), /check constraint/);
    await db.query("update project_ideas set horas_reales=0 where id=$1", [idea.id]);
    await db.query("update project_ideas set horas_reales=null where id=$1", [idea.id]);
    await db.query(`update project_ideas set fecha_envio_estimacion='2026-10-20', fecha_envio_cotizacion='2026-10-21',
      proveedor_externo=true, prioridad=true, estado_cotizacion='Observada' where id=$1`, [idea.id]);
    await assert.rejects(db.query("update project_ideas set estado_cotizacion='Invalido' where id=$1", [idea.id]), /check constraint/);
    await db.query(`update project_ideas set costo_cotizacion=123.45,horas_estimacion=8.5,horas_reales=12.75,
      alcance_proyecto=$2, titulo_correo=$3, sociedad=$4, usuario_solicitante=$5, responsables=$6 where id=$1`,
      [idea.id, values.alcance_proyecto, values.titulo_correo, values.sociedad, values.usuario_solicitante, values.responsables]);
    assert.equal(Number((await db.query("select costo_cotizacion from project_ideas")).rows[0].costo_cotizacion), 123.45);
    assert.equal(Number((await db.query("select horas_reales from project_ideas")).rows[0].horas_reales), 12.75);
  });
  assert.equal((await db.query("select updated_by from project_ideas")).rows[0].updated_by, ids.manager);
  const original = (await db.query("select alcance_proyecto,subject_correo,formato,usuario_solicitante from tickets where id=$1", [ticketId])).rows[0];
  assert.deepEqual(original, { alcance_proyecto: ticket.alcance_proyecto, subject_correo: ticket.subject_correo,
    formato: ticket.formato, usuario_solicitante: ticket.usuario_solicitante }, "Idea edits must not change the ticket");
  assert.deepEqual((await db.query("select resource_name from ticket_responsables where ticket_id=$1 order by resource_name", [ticketId])).rows.map(row => row.resource_name), ["Leader", "Worker"]);
  await db.exec(`drop policy "project ideas read manager" on project_ideas;
    create policy "project ideas read manager" on project_ideas for select to authenticated
      using (public.current_profile_role() = 'consulta_proyectos');`);
  await db.exec(readFileSync(new URL("../supabase/allow_admin_project_ideas.sql", import.meta.url), "utf8"));
  await asUser(ids.admin, async () => {
    assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1);
    assert.equal((await db.query("update project_ideas set costo_cotizacion=999 returning id")).rows.length, 1);
    await assert.rejects(db.query("update project_ideas set ticket_id=gen_random_uuid()"), /permission denied/);
    await assert.rejects(db.query("update project_ideas set id=gen_random_uuid()"), /permission denied/);
  });
  await db.exec(migration);
  assert.equal((await db.query("select alcance_proyecto from project_ideas where id=$1", [idea.id])).rows[0].alcance_proyecto, values.alcance_proyecto, "Re-running migration must preserve idea corrections");
  assert.equal(Number((await db.query("select horas_reales from project_ideas where id=$1", [idea.id])).rows[0].horas_reales), 12.75);
  await db.exec(improvements);
  const tracked = (await db.query("select * from project_ideas where id=$1", [idea.id])).rows[0];
  assert.equal(tracked.estado_cotizacion, "Observada");
  assert.equal(tracked.prioridad, true);
  assert.equal(tracked.proveedor_externo, true);
  assert(tracked.fecha_envio_estimacion && tracked.fecha_envio_cotizacion);
  await create({ ...ticket, codigo_tck: "ANT260002" });
  assert.equal((await db.query("select count(distinct correlativo)::int n from project_ideas")).rows[0].n, 2);
  const peer = "00000000-0000-4000-8000-000000000007";
  const outsider = "00000000-0000-4000-8000-000000000008";
  const otherTeam = "10000000-0000-4000-8000-000000000002";
  for (const id of [peer, outsider]) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query(`insert into profiles(id,email,display_name,role,resource_name,active)
      values ($1,$2,'Leader','trabajador_aplicaciones','Leader',true)`, [id, `${id}@test.local`]);
  }
  await db.query("insert into teams(id,name) values ($1,'Otro equipo')", [otherTeam]);
  await db.query("insert into profile_teams(profile_id,team_id,is_leader) values ($1,$2,true),($3,$4,true)", [peer, teamId, outsider, otherTeam]);
  await create({ ...ticket, codigo_tck: "ANT-PEER" }, peer);
  await create({ ...ticket, codigo_tck: "ANT-OUTSIDER" }, outsider);
  async function visibleTickets(actor) {
    return asUser(actor, async () => (await db.query("select ticket_id from project_ideas")).rows.map(row => row.ticket_id));
  }
  assert.equal((await visibleTickets(ids.leader)).length, 3, "Leader must see teammate-created ideas, not other teams");
  assert.equal((await visibleTickets(peer)).length, 3);
  assert.equal((await visibleTickets(outsider)).length, 1, "Shared responsible names must not grant access across teams");
  assert.equal((await visibleTickets(ids.admin)).length, 4);
  assert.equal((await visibleTickets(ids.manager)).length, 4);
  await db.query("update profile_teams set is_leader=false where profile_id=$1", [peer]);
  assert.equal((await visibleTickets(peer)).length, 0);
  assert.equal((await visibleTickets(ids.leader)).length, 3, "Past leaders' ideas remain visible in their team");
  await db.query("update teams set active=false where id=$1", [teamId]);
  assert.equal((await visibleTickets(ids.leader)).length, 0);
  await db.query("update teams set active=true where id=$1", [teamId]);
  await db.query("update profiles set active=false where id=$1", [ids.leader]);
  assert.equal((await visibleTickets(ids.leader)).length, 0);
  await db.query("update profiles set active=true where id=$1", [ids.leader]);
  // Old migrations must not remove team visibility or the new editable columns.
  await db.exec(editMigration);
  await asUser(ids.manager, () => db.query("update project_ideas set prioridad=false,proveedor_externo=false,fecha_envio_estimacion=null,fecha_envio_cotizacion=null where id=$1", [idea.id]));
  await db.exec(migration);
  assert.equal((await visibleTickets(ids.leader)).length, 3);
  await asUser(ids.manager, () => db.query("update project_ideas set prioridad=false,proveedor_externo=false,fecha_envio_estimacion=null,fecha_envio_cotizacion=null where id=$1", [idea.id]));
  console.log("PASS: validation, upgrades, defaults, Observada, team-scoped leader reads, read-only leaders, inactive/team isolation, admin/manager editing, atomic creation and original tickets preserved.");
} finally { await db.close(); }
