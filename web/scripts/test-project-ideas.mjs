import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const require = createRequire(import.meta.url);
function loadTs(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", compiled)(module, module.exports, require);
  return module.exports;
}
const { cleanProjectIdeaUpdate, isProjectPlanning } = loadTs("../lib/project-ideas.ts");
const values = { horas_estimacion: null, costo_cotizacion: null, estado_cotizacion: "Por entregar",
  fecha_inicio: null, fecha_fin: null, estado_atencion: "Por aprobar cotizacion", bloqueantes: "" };
assert(isProjectPlanning({ tipo_atencion: "Anteproyecto", subcategoria_atencion: " Planificaci\u00f3n " }));
assert(!isProjectPlanning({ tipo_atencion: "Proyecto", subcategoria_atencion: "Planificacion" }));
assert.deepEqual(cleanProjectIdeaUpdate(values), values);
assert.equal(cleanProjectIdeaUpdate({ ...values, costo_cotizacion: 123.45 }).costo_cotizacion, 123.45);
for (const patch of [{ costo_cotizacion: -1 }, { horas_estimacion: "4" }, { horas_estimacion: Infinity },
  { fecha_inicio: "2026-02-30" }, { fecha_inicio: "2026-10-20", fecha_fin: "2026-10-19" }, { estado_cotizacion: "Cerrado" }]) {
  assert.throws(() => cleanProjectIdeaUpdate({ ...values, ...patch }));
}
assert(!("ticket_id" in cleanProjectIdeaUpdate({ ...values, ticket_id: "changed" })));

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
  assert.equal(idea.costo_cotizacion, null);
  assert.equal(idea.estado_cotizacion, "Por entregar");
  assert.equal((await db.query("select count(*)::int n from ticket_responsables where ticket_id=$1", [ticketId])).rows[0].n, 2);
  await db.query("update tickets set fecha_termino='2026-10-21' where id=$1", [ticketId]);
  assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1, "Editing must not duplicate idea");
  await assert.rejects(db.query("update tickets set alcance_proyecto='' where id=$1", [ticketId]), /obligatorios/);
  await assert.rejects(db.query("update tickets set tipo_atencion='Proyecto' where id=$1", [ticketId]), /conservar/);
  await db.exec("grant select, insert, update, delete on all tables in schema public to authenticated;");
  // Restore the migration's column permissions after simulating Supabase grants on legacy tables.
  await db.exec("revoke all on public.project_ideas from authenticated; grant select on public.project_ideas to authenticated; grant update (horas_estimacion,costo_cotizacion,estado_cotizacion,fecha_inicio,fecha_fin,estado_atencion,bloqueantes) on public.project_ideas to authenticated;");
  async function asUser(id, work) {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    try { return await work(); } finally { await db.exec("reset role"); }
  }
  for (const actor of [ids.leader, ids.worker, ids.admin, ids.bi]) {
    await asUser(actor, async () => {
      assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, actor === ids.admin ? 1 : 0);
      const updated = await db.query("update project_ideas set costo_cotizacion=900 returning id");
      assert.equal(updated.rows.length, 0, "Only project manager can update tracking");
    });
  }
  await asUser(ids.manager, async () => {
    assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from tickets")).rows[0].n, 0, "Manager must not read raw tickets");
    assert.equal((await db.query("select count(*)::int n from resources")).rows[0].n, 0, "Manager must not read other modules");
    await assert.rejects(db.query("update project_ideas set ticket_id=gen_random_uuid()"), /permission denied/);
    await assert.rejects(db.query("delete from project_ideas"), /permission denied/);
    await assert.rejects(db.query("select public.create_project_planning_ticket($1::jsonb,$2::text[],$3::uuid)", [JSON.stringify(ticket), ["Leader"], ids.leader]), /permission denied/);
    await db.query("update project_ideas set costo_cotizacion=123.45,horas_estimacion=8.5 where id=$1", [idea.id]);
    assert.equal(Number((await db.query("select costo_cotizacion from project_ideas")).rows[0].costo_cotizacion), 123.45);
  });
  assert.equal((await db.query("select updated_by from project_ideas")).rows[0].updated_by, ids.manager);
  await db.exec(`drop policy "project ideas read manager" on project_ideas;
    create policy "project ideas read manager" on project_ideas for select to authenticated
      using (public.current_profile_role() = 'consulta_proyectos');`);
  await db.exec(readFileSync(new URL("../supabase/allow_admin_project_ideas.sql", import.meta.url), "utf8"));
  await asUser(ids.admin, async () => {
    assert.equal((await db.query("select count(*)::int n from project_ideas")).rows[0].n, 1);
    assert.equal((await db.query("update project_ideas set costo_cotizacion=999 returning id")).rows.length, 0);
  });
  await db.exec(migration);
  await create({ ...ticket, codigo_tck: "ANT260002" });
  assert.equal((await db.query("select count(distinct correlativo)::int n from project_ideas")).rows[0].n, 2);
  console.log("PASS: validation, upgrade/re-run, leader permissions, atomic creation, unique correlatives, empty dates, edit permissions and module isolation.");
} finally { await db.close(); }
