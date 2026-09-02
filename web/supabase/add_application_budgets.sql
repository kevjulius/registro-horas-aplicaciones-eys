-- Agrega presupuesto mensual fijo por sistema/sociedad para reporte Presupuesto vs Consumo.
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.application_budgets (
  id bigint generated always as identity primary key,
  anio integer not null check (anio >= 2000),
  equipo text not null check (equipo in ('Aplicaciones', 'BI')),
  sistema text not null,
  sociedad text not null,
  horas_presupuestadas_mes numeric(12,3) not null check (horas_presupuestadas_mes >= 0),
  material_cf text not null default '',
  glosa_pl text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_budgets_lookup_idx
  on public.application_budgets (anio, equipo, sistema, sociedad)
  where active = true;

alter table public.application_budgets enable row level security;

drop policy if exists "application budgets read admin" on public.application_budgets;
create policy "application budgets read admin" on public.application_budgets
for select using (
  public.current_profile_role() = 'administracion'
  or (public.current_profile_role() = 'adminbi' and equipo = 'BI')
);

-- Reemplaza la carga 2026 para que el script sea reejecutable.
delete from public.application_budgets where anio = 2026;

insert into public.application_budgets
  (anio, equipo, sistema, sociedad, horas_presupuestadas_mes, material_cf, glosa_pl)
values
  (2026, 'Aplicaciones', 'Cubo de clientes Makro', 'A124', 44.82, 'MAT000211', 'MAT000211 - Soporte Gestión de Datos'),
  (2026, 'Aplicaciones', 'Gestión de Carteras', 'A124', 44, 'MAT000211', 'MAT000211 - Soporte Gestión de Datos'),
  (2026, 'Aplicaciones', 'Soporte Reportes Clientes Makro', 'A124', 74, 'MAT000211', 'MAT000211 - Soporte Gestión de Datos'),
  (2026, 'Aplicaciones', 'Soporte Reportes Mass', 'A126', 46.12, 'MAT000211', 'MAT000211 - Soporte Gestión de Datos'),
  (2026, 'Aplicaciones', 'Soporte Reportes Plaza Vea/Vivanda', 'A125', 24.917, 'MAT000211', 'MAT000211 - Soporte Gestión de Datos'),
  (2026, 'Aplicaciones', 'Web de Clientes Makro', 'A124', 8.999, 'MAT000254', 'MAT000254 - Soporte Web Makro'),
  (2026, 'Aplicaciones', 'Web Makro', 'A124', 13, 'MAT000254', 'MAT000254 - Soporte Web Makro'),
  (2026, 'Aplicaciones', 'ADT - Reflexis', 'A124', 20, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'App PMM Pocket', 'A124', 22, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Compensador de Horas Extras', 'A124', 9, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Scheduler', 'A124', 36, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Sistema de Impresión de Viñetas', 'A124', 11.01, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Quemador de Ticket', 'A124', 18, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'ADT - Reflexis', 'A125', 21.116, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'App PMM Pocket', 'A125', 46, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Modulo de Comisiones', 'A125', 12, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Scheduler', 'A125', 20, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Scheduler FUM (Piso de venta, Recepción)', 'A125', 10, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Sistema de Análisis de Inventarios', 'A125', 10, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Sistema de Control de Inventario', 'A125', 14, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Sistema de Impresión de Viñetas', 'A125', 28, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Workflow proximos a vencer', 'A125', 48, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'App PMM Pocket', 'A126', 43.209, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Consumo Interno', 'A126', 14.7, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Centralización de viñetas', 'A126', 14.7, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Automatización de reportes', 'A126', 14.7, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Soporte One App', 'A126', 44, 'MAT000260', 'MAT000260 - Soporte Aplicaciones Operación'),
  (2026, 'Aplicaciones', 'Integración Genesis con Salesforce', 'A124', 90.97, 'MAT000260', 'MAT200012 - Soporte Desarrollo Sales Force'),
  (2026, 'Aplicaciones', 'Salesforce Sales Cloud - Makro', 'A124', 128, 'MAT000260', 'MAT200012 - Soporte Desarrollo Sales Force'),
  (2026, 'Aplicaciones', 'Salesforce Marketing Cloud', 'A124', 16, 'MAT200012', 'MAT200012 - Soporte Desarrollo Sales Force'),
  (2026, 'Aplicaciones', 'Salesforce Sales Cloud - Merkao', 'A128', 41, 'MAT200012', 'MAT200012 - Soporte Desarrollo Sales Force'),
  (2026, 'Aplicaciones', 'Plataforma SalesMaps', 'A124', 50.13, 'MAT200066', 'MAT200066 - Soporte Plataforma SalesMaps'),
  (2026, 'Aplicaciones', 'Plataforma SalesMaps', 'A128', 11, 'MAT200066', 'MAT200066 - Soporte Plataforma SalesMaps'),
  (2026, 'Aplicaciones', 'Aplicativo Catman', 'A129', 28, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'Sistema de Administración de Surtido', 'A129', 80, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'Pricing IA', 'A129', 40, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'Portal de Promociones', 'A129', 240, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'Portal de Solicitudes DM', 'A129', 20, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'PricingBOT', 'A129', 232, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'PricingGO', 'A129', 233.6, 'MAT220045', 'MAT220045 - Soporte Aplicaciones Comercial'),
  (2026, 'Aplicaciones', 'Sistema de Cartelería', 'A124', 45, 'MAT230026', 'MAT230026 - Soporte Aplicaciones Marketing'),
  (2026, 'Aplicaciones', 'Registro de Clientes - Vivanda', 'A125', 2, 'MAT230026', 'MAT230026 - Soporte Aplicaciones Marketing'),
  (2026, 'Aplicaciones', 'Sistema de Cartelería', 'A125', 75, 'MAT230026', 'MAT230026 - Soporte Aplicaciones Marketing'),
  (2026, 'Aplicaciones', 'Monday', 'A126', 22.78, 'MAT230027', 'MAT230027 - Soporte Aplicaciones Mass'),
  (2026, 'Aplicaciones', 'Libro de Reclamaciones - Mass', 'A126', 18, 'MAT230027', 'MAT230027 - Soporte Aplicaciones Mass'),
  (2026, 'Aplicaciones', 'Soporte One App', 'A126', 18, 'MAT230027', 'MAT230027 - Soporte Aplicaciones Mass'),
  (2026, 'Aplicaciones', 'Fracttal', 'A124', 5.76, 'MAT230028', 'MAT230028 - Soporte Fracttal'),
  (2026, 'Aplicaciones', 'Fracttal', 'A125', 50.09, 'MAT230028', 'MAT230028 - Soporte Fracttal'),
  (2026, 'Aplicaciones', 'Fracttal', 'A126', 3.629, 'MAT230028', 'MAT230028 - Soporte Fracttal'),
  (2026, 'Aplicaciones', 'Fracttal', 'A127', 5.76, 'MAT230028', 'MAT230028 - Soporte Fracttal'),
  (2026, 'Aplicaciones', 'Fracttal', 'A129', 19.629, 'MAT230028', 'MAT230028 - Soporte Fracttal'),
  (2026, 'Aplicaciones', 'Sistema de Atención de Clientes (SAC)', 'A124', 103.429, 'MAT230030', 'MAT230030 - Soporte Plataforma Clientes Makro'),
  (2026, 'Aplicaciones', 'Web Tiendasmass', 'A126', 22.19, 'MAT230038', 'MAT230038 - Soporte Web CHD'),
  (2026, 'Aplicaciones', 'Sistema de Marcación Kronos', 'A124', 22.2691, 'MAT240057', 'MAT240057 - Soporte GDH'),
  (2026, 'Aplicaciones', 'Sistema de Marcación Kronos', 'A125', 21, 'MAT240057', 'MAT240057 - Soporte GDH'),
  (2026, 'Aplicaciones', 'Soporte Mypaltime', 'A126', 5, 'MAT240057', 'MAT240057 - Soporte GDH'),
  (2026, 'Aplicaciones', 'Sistema de Marcación Kronos', 'A126', 16, 'MAT240057', 'MAT240057 - Soporte GDH'),
  (2026, 'Aplicaciones', 'Sistema de Marcación Kronos', 'A127', 21, 'MAT240057', 'MAT240057 - Soporte GDH'),
  (2026, 'Aplicaciones', 'Sistema de Marcación Kronos', 'A129', 81, 'MAT240057', 'MAT240057 - Soporte GDH'),
  (2026, 'Aplicaciones', 'BOT - Massimo', 'A126', 26, 'MAT250001', 'MAT250001 - Soporte RPA - Automatización de Procesos'),
  (2026, 'Aplicaciones', 'BOT - Descarga de Servicios', 'A126', 26, 'MAT250001', 'MAT250001 - Soporte RPA - Automatización de Procesos'),
  (2026, 'Aplicaciones', 'BOT - Apertura de tiendas', 'A126', 67, 'MAT250001', 'MAT250001 - Soporte RPA - Automatización de Procesos'),
  (2026, 'Aplicaciones', 'BOT - Bono de Productividad - CUL', 'A129', 18, 'MAT250001', 'MAT250001 - Soporte RPA - Automatización de Procesos'),
  (2026, 'Aplicaciones', 'BOT - Tesorería - Registros Facturas', 'A129', 34, 'MAT250001', 'MAT250001 - Soporte RPA - Automatización de Procesos'),
  (2026, 'Aplicaciones', 'BOT - Medios de Pago', 'A129', 26, 'MAT250001', 'MAT250001 - Soporte RPA - Automatización de Procesos'),
  (2026, 'Aplicaciones', 'Servicio Google Maps', 'A124', 104.24, 'MAT220034', 'MAT220034 - Servicio Google Maps'),
  (2026, 'Aplicaciones', 'Sistema de Acuerdo Comercial Adicional GAC', 'A129', 80, 'MAT200056', 'MAT200056 - Soporte de Acuerdos Comerciales'),
  (2026, 'BI', 'Sistema de Acuerdo Comercial Adicional GAC', 'A129', 80, 'MAT200056', 'MAT200056 - Soporte de Acuerdos Comerciales'),
  (2026, 'BI', 'Soporte plataforma GCP BI', 'A129', 220, 'MAT000226', 'MAT000226 - Soporte plataforma GCP BI'),
  (2026, 'BI', 'Soporte Plataforma Power BI', 'A129', 181, 'MAT220036', 'MAT220036 - Soporte Plataforma Power BI'),
  (2026, 'BI', 'Soporte Información al Corporativo', 'A129', 59.469, 'MAT220037', 'MAT220037 - Soporte Información al Corporativo'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A129', 11.658, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A129', 11, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A129', 83, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A125', 5.67, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A125', 5.8, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A125', 25.8, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A124', 5.65, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A124', 5.5, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A124', 41.5, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A126', 1.51, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A126', 1.5, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A126', 8.5, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A127', 2.53, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A127', 3, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A127', 7, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A128', 1.085, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A128', 1, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte aplicaciones BI', 'A128', 2.5, 'MAT220072', 'MAT220072 - Soporte aplicaciones BI'),
  (2026, 'BI', 'Soporte plataforma azure BI', 'A129', 198, 'MAT230007', 'MAT230007 - Soporte plataforma azure BI');
