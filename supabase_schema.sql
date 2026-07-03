-- Encuesta de Línea Base — GeoOrigen Campo
-- Ejecutar en: Supabase > SQL Editor

create table if not exists public.encuestas_linea_base (
  id uuid primary key,

  -- PRODUCTOR
  tipo_dni text,
  dni text,
  nombre text,
  telefono text,
  direccion text,
  escolaridad text,
  fecha_nac date,
  sexo text,
  estado_civil text,

  -- FINCA
  finca text,
  depto text,
  municipio text,
  altitud_msnm numeric,
  latitud numeric,
  longitud numeric,
  area_total_ha numeric,
  area_cafe_ha numeric,
  area_prod_ha numeric,
  area_levante_ha numeric,
  area_bosque_ha numeric,
  otros_cultivos_ha numeric,
  pastos_ha numeric,
  renovacion_ha numeric,
  produccion_anual numeric,
  unidad_prod text,
  fuente_agua text,
  trat_mieles_sn text,
  tipo_tratamiento text,
  fosa_pulpa text,
  analisis_suelos text,
  ano_analisis numeric,
  acceso_vial text,

  -- INFRAESTRUCTURA
  beneficiadero text,
  despulpadora text,
  fermentacion text,
  secado text,
  bodega text,
  energia text,
  internet text,
  red_celular text,
  operador text,

  -- LOTES (hasta 5, guardados como arreglo JSON)
  -- cada elemento: {nombre, variedad, var_otra, sombrio, area_lote, area_cafe,
  --                 num_plant, edad, dist_calle, dist_plant, productivo}
  lotes jsonb default '[]'::jsonb,

  -- COSECHA
  cosecha_ppal text,
  mitaca text,
  meses_detalle text,
  ferm_horas numeric,
  lavado text,
  proc_especiales text,
  tipo_proceso text,
  cual_proceso text,
  obs_cosecha text,

  -- CALIDAD
  certificaciones text,
  tipo_certif text,
  cual_certif text,
  concursos text,
  nombre_concurso text,
  conoce_puntaje text,
  puntaje_taza numeric,
  primas text,
  comprador text,
  precio_cop numeric,
  obs_calidad text,

  -- metadatos
  creado_en timestamptz,
  actualizado_en timestamptz,
  recibido_en timestamptz default now()
);

-- Seguridad: habilita RLS y permite operaciones solo a usuarios autenticados.
-- Como es una app interna para colaboradores, la forma más simple es crear
-- un usuario (o uno por colaborador) en Supabase Auth y loguearse desde la app.
alter table public.encuestas_linea_base enable row level security;

create policy "Colaboradores autenticados pueden insertar"
  on public.encuestas_linea_base for insert
  to authenticated
  with check (true);

create policy "Colaboradores autenticados pueden actualizar"
  on public.encuestas_linea_base for update
  to authenticated
  using (true);

create policy "Colaboradores autenticados pueden leer"
  on public.encuestas_linea_base for select
  to authenticated
  using (true);

-- Vista plana lista para exportar a Excel (aplana lotes 1-5 en columnas,
-- igual al formato original que compartiste)
create or replace view public.encuestas_linea_base_excel as
select
  id, tipo_dni, dni, nombre, telefono, direccion, escolaridad, fecha_nac, sexo, estado_civil,
  finca, depto, municipio, altitud_msnm, latitud, longitud, area_total_ha, area_cafe_ha,
  area_prod_ha, area_levante_ha, area_bosque_ha, otros_cultivos_ha, pastos_ha, renovacion_ha,
  produccion_anual, unidad_prod, fuente_agua, trat_mieles_sn, tipo_tratamiento, fosa_pulpa,
  analisis_suelos, ano_analisis, acceso_vial,
  beneficiadero, despulpadora, fermentacion, secado, bodega, energia, internet, red_celular, operador,
  lotes->0->>'nombre' as l1_nombre, lotes->0->>'variedad' as l1_variedad, lotes->0->>'var_otra' as l1_var_otra,
  lotes->0->>'sombrio' as l1_sombrio, lotes->0->>'area_lote' as l1_area_lote, lotes->0->>'area_cafe' as l1_area_cafe,
  lotes->0->>'num_plant' as l1_num_plant, lotes->0->>'edad' as l1_edad, lotes->0->>'dist_calle' as l1_dist_calle,
  lotes->0->>'dist_plant' as l1_dist_plant, lotes->0->>'productivo' as l1_productivo,
  lotes->1->>'nombre' as l2_nombre, lotes->1->>'variedad' as l2_variedad, lotes->1->>'var_otra' as l2_var_otra,
  lotes->1->>'sombrio' as l2_sombrio, lotes->1->>'area_lote' as l2_area_lote, lotes->1->>'area_cafe' as l2_area_cafe,
  lotes->1->>'num_plant' as l2_num_plant, lotes->1->>'edad' as l2_edad, lotes->1->>'dist_calle' as l2_dist_calle,
  lotes->1->>'dist_plant' as l2_dist_plant, lotes->1->>'productivo' as l2_productivo,
  lotes->2->>'nombre' as l3_nombre, lotes->2->>'variedad' as l3_variedad, lotes->2->>'var_otra' as l3_var_otra,
  lotes->2->>'sombrio' as l3_sombrio, lotes->2->>'area_lote' as l3_area_lote, lotes->2->>'area_cafe' as l3_area_cafe,
  lotes->2->>'num_plant' as l3_num_plant, lotes->2->>'edad' as l3_edad, lotes->2->>'dist_calle' as l3_dist_calle,
  lotes->2->>'dist_plant' as l3_dist_plant, lotes->2->>'productivo' as l3_productivo,
  lotes->3->>'nombre' as l4_nombre, lotes->3->>'variedad' as l4_variedad, lotes->3->>'var_otra' as l4_var_otra,
  lotes->3->>'sombrio' as l4_sombrio, lotes->3->>'area_lote' as l4_area_lote, lotes->3->>'area_cafe' as l4_area_cafe,
  lotes->3->>'num_plant' as l4_num_plant, lotes->3->>'edad' as l4_edad, lotes->3->>'dist_calle' as l4_dist_calle,
  lotes->3->>'dist_plant' as l4_dist_plant, lotes->3->>'productivo' as l4_productivo,
  lotes->4->>'nombre' as l5_nombre, lotes->4->>'variedad' as l5_variedad, lotes->4->>'var_otra' as l5_var_otra,
  lotes->4->>'sombrio' as l5_sombrio, lotes->4->>'area_lote' as l5_area_lote, lotes->4->>'area_cafe' as l5_area_cafe,
  lotes->4->>'num_plant' as l5_num_plant, lotes->4->>'edad' as l5_edad, lotes->4->>'dist_calle' as l5_dist_calle,
  lotes->4->>'dist_plant' as l5_dist_plant, lotes->4->>'productivo' as l5_productivo,
  cosecha_ppal, mitaca, meses_detalle, ferm_horas, lavado, proc_especiales, tipo_proceso, cual_proceso, obs_cosecha,
  certificaciones, tipo_certif, cual_certif, concursos, nombre_concurso, conoce_puntaje, puntaje_taza,
  primas, comprador, precio_cop, obs_calidad,
  creado_en, actualizado_en, recibido_en
from public.encuestas_linea_base;
