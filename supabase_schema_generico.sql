-- Registros genéricos por esquema (Cacao y futuros formularios)
-- A diferencia de la encuesta de Café (que tiene su propia tabla con columnas
-- fijas), estos registros guardan sus respuestas como JSONB en la columna
-- 'datos', identificados por 'tipo' (ej. 'cacao'). Esto permite agregar
-- nuevos formularios sin tener que crear una tabla nueva cada vez.
-- Ejecutar en: Supabase > SQL Editor

create table if not exists public.registros_campo (
  id uuid primary key,
  tipo text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_en timestamptz,
  actualizado_en timestamptz,
  recibido_en timestamptz default now()
);

create index if not exists idx_registros_campo_tipo on public.registros_campo (tipo);

alter table public.registros_campo enable row level security;

create policy "Colaboradores autenticados pueden insertar registros"
  on public.registros_campo for insert
  to authenticated
  with check (true);

create policy "Colaboradores autenticados pueden actualizar registros"
  on public.registros_campo for update
  to authenticated
  using (true);

create policy "Colaboradores autenticados pueden leer registros"
  on public.registros_campo for select
  to authenticated
  using (true);

-- Vista plana lista para exportar Cacao a Excel (aplana el JSONB en columnas)
create or replace view public.registros_cacao_excel as
select
  id,
  datos->>'fecha_encuesta' as fecha_encuesta, datos->>'encuestador' as encuestador,
  datos->>'nombre' as nombre, datos->>'tipo_dni' as tipo_dni, datos->>'dni' as dni,
  datos->>'genero' as genero, datos->>'fecha_nac' as fecha_nac, datos->>'edad' as edad,
  datos->>'estado_civil' as estado_civil, datos->>'nivel_educativo' as nivel_educativo,
  datos->>'telefono' as telefono, datos->>'correo' as correo,

  datos->>'num_integrantes' as num_integrantes, datos->>'personas_eco_activas' as personas_eco_activas,
  datos->>'mujeres' as mujeres, datos->>'hombres' as hombres, datos->>'jovenes' as jovenes,
  datos->>'adultos_mayores' as adultos_mayores, datos->>'mano_obra_familiar' as mano_obra_familiar,
  datos->>'mano_obra_contratada' as mano_obra_contratada, datos->>'actividad_principal' as actividad_principal,
  datos->>'actividades_secundarias' as actividades_secundarias,

  datos->>'pertenece_asociacion' as pertenece_asociacion, datos->>'nombre_asociacion' as nombre_asociacion,
  datos->>'ano_ingreso' as ano_ingreso, datos->>'participa_juntas' as participa_juntas,
  datos->>'cargo_junta' as cargo_junta,
  datos->>'recibe_asistencia' as recibe_asistencia, datos->>'institucion_asistencia' as institucion_asistencia,
  datos->>'frecuencia_asistencia' as frecuencia_asistencia, datos->>'participa_ecas' as participa_ecas,
  datos->>'acceso_creditos' as acceso_creditos, datos->>'entidad_financiera' as entidad_financiera,
  datos->>'acceso_incentivos' as acceso_incentivos,

  datos->>'depto' as depto, datos->>'municipio' as municipio, datos->>'vereda' as vereda,
  datos->>'indicaciones_llegada' as indicaciones_llegada, datos->>'altitud' as altitud, datos->>'latitud' as latitud,
  datos->>'longitud' as longitud, datos->>'coord_lote_principal' as coord_lote_principal,
  datos->>'distancia_casco_urbano' as distancia_casco_urbano, datos->>'tiempo_cabecera' as tiempo_cabecera,

  datos->>'nombre_predio' as nombre_predio, datos->>'tenencia' as tenencia,
  datos->>'area_total' as area_total, datos->>'area_agricola' as area_agricola,
  datos->>'area_cacao' as area_cacao, datos->>'area_prod' as area_prod, datos->>'area_levante' as area_levante,
  datos->>'area_bosque' as area_bosque,
  datos->>'area_conservacion' as area_conservacion, datos->>'area_otros_cultivos' as area_otros_cultivos,
  datos->>'num_lotes' as num_lotes,

  datos->>'ano_establecimiento' as ano_establecimiento, datos->>'edad_promedio' as edad_promedio,
  datos->>'material_vegetal' as material_vegetal, datos->>'clones_sembrados' as clones_sembrados,
  datos->>'origen_material' as origen_material, datos->>'num_arboles' as num_arboles,
  datos->>'dist_arboles' as dist_arboles, datos->>'dist_calle' as dist_calle,
  datos->>'tipo_sombra' as tipo_sombra, datos->>'porcentaje_sombra' as porcentaje_sombra,
  datos->>'arboles_sombrio_ha' as arboles_sombrio_ha,
  datos->>'injertacion' as injertacion,

  datos->>'plan_fertilizacion' as plan_fertilizacion, datos->>'tipo_fertilizante' as tipo_fertilizante,
  datos->>'fertilizacion_organica' as fertilizacion_organica, datos->>'fertilizacion_quimica' as fertilizacion_quimica,
  datos->>'enmiendas' as enmiendas, datos->>'analisis_suelo' as analisis_suelo,
  datos->>'fecha_ultimo_analisis' as fecha_ultimo_analisis, datos->>'encalado' as encalado,
  datos->>'cobertura_vegetal' as cobertura_vegetal, datos->>'manejo_arvenses' as manejo_arvenses,
  datos->>'riego' as riego, datos->>'drenaje' as drenaje,

  datos->>'principales_plagas' as principales_plagas, datos->>'principales_enfermedades' as principales_enfermedades,
  datos->>'moniliasis' as moniliasis, datos->>'escoba_bruja' as escoba_bruja,
  datos->>'mazorca_negra' as mazorca_negra, datos->>'frecuencia_monitoreo' as frecuencia_monitoreo,
  datos->>'control_biologico' as control_biologico, datos->>'control_quimico' as control_quimico,
  datos->>'manejo_integrado' as manejo_integrado, datos->>'registros_fitosanitarios' as registros_fitosanitarios,

  datos->>'poda_formacion' as poda_formacion, datos->>'poda_mantenimiento' as poda_mantenimiento,
  datos->>'poda_sanitaria' as poda_sanitaria, datos->>'frecuencia_poda' as frecuencia_poda,
  datos->>'herramientas_utilizadas' as herramientas_utilizadas,

  datos->>'produccion_anual' as produccion_anual, datos->>'produccion_cosecha' as produccion_cosecha,
  datos->>'rendimiento_kg_ha' as rendimiento_kg_ha, datos->>'num_cosechas' as num_cosechas,
  datos->>'porcentaje_perdidas' as porcentaje_perdidas, datos->>'causas_perdidas' as causas_perdidas,

  datos->>'fermentacion' as fermentacion, datos->>'tipo_fermentador' as tipo_fermentador,
  datos->>'tiempo_fermentacion' as tiempo_fermentacion, datos->>'secado' as secado,
  datos->>'tipo_secador' as tipo_secador, datos->>'tiempo_secado' as tiempo_secado,
  datos->>'humedad_final' as humedad_final, datos->>'almacenamiento' as almacenamiento,
  datos->>'empaque' as empaque,

  datos->>'clasificacion_grano' as clasificacion_grano, datos->>'porcentaje_fermentacion' as porcentaje_fermentacion,
  datos->>'impurezas' as impurezas, datos->>'certificaciones' as certificaciones,
  datos->>'cumplimiento_estandares' as cumplimiento_estandares, datos->>'trazabilidad' as trazabilidad,

  datos->>'comprador_principal' as comprador_principal, datos->>'tipo_comprador' as tipo_comprador,
  datos->>'frecuencia_venta' as frecuencia_venta, datos->>'precio_promedio' as precio_promedio,
  datos->>'forma_pago' as forma_pago, datos->>'volumen_comercializado' as volumen_comercializado,
  datos->>'valor_agregado' as valor_agregado, datos->>'transformacion' as transformacion,
  datos->>'acceso_mercados_diferenciados' as acceso_mercados_diferenciados,
  datos->>'exportacion_indirecta' as exportacion_indirecta,

  datos->>'vivienda' as vivienda, datos->>'bodega' as bodega, datos->>'centro_acopio' as centro_acopio,
  datos->>'fermentadores' as fermentadores, datos->>'marquesina' as marquesina,
  datos->>'secador_solar' as secador_solar, datos->>'secador_mecanico' as secador_mecanico,
  datos->>'bascula' as bascula, datos->>'despulpadora' as despulpadora,
  datos->>'herramientas_infra' as herramientas_infra, datos->>'motobomba' as motobomba,
  datos->>'vehiculo' as vehiculo,

  datos->>'nacimientos' as nacimientos, datos->>'quebradas' as quebradas,
  datos->>'proteccion_rondas' as proteccion_rondas, datos->>'reforestacion' as reforestacion,
  datos->>'conservacion_bosques' as conservacion_bosques, datos->>'biodiversidad' as biodiversidad,
  datos->>'polinizadores' as polinizadores, datos->>'manejo_residuos' as manejo_residuos,
  datos->>'compostaje' as compostaje, datos->>'envases_agroquimicos' as envases_agroquimicos,
  datos->>'captura_carbono' as captura_carbono,

  datos->>'percepcion_cambio_climatico' as percepcion_cambio_climatico, datos->>'eventos_extremos' as eventos_extremos,
  datos->>'sequias' as sequias, datos->>'exceso_lluvia' as exceso_lluvia,
  datos->>'estrategias_adaptacion' as estrategias_adaptacion,
  datos->>'sistemas_agroforestales' as sistemas_agroforestales,
  datos->>'variedades_resilientes' as variedades_resilientes,

  datos->>'costos_produccion' as costos_produccion, datos->>'costos_cosecha' as costos_cosecha,
  datos->>'costos_fertilizacion' as costos_fertilizacion, datos->>'ingresos_cacao' as ingresos_cacao,
  datos->>'otros_ingresos' as otros_ingresos,

  datos->>'smartphone' as smartphone, datos->>'computador' as computador, datos->>'internet' as internet,
  datos->>'cobertura_celular' as cobertura_celular, datos->>'whatsapp' as whatsapp,
  datos->>'uso_apps_agricolas' as uso_apps_agricolas,

  datos->>'agua_potable' as agua_potable, datos->>'energia_electrica' as energia_electrica,
  datos->>'alcantarillado' as alcantarillado, datos->>'manejo_residuos_bienestar' as manejo_residuos_bienestar,
  datos->>'afiliacion_salud' as afiliacion_salud, datos->>'riesgos_laborales' as riesgos_laborales,
  datos->>'elementos_proteccion' as elementos_proteccion,

  creado_en, actualizado_en, recibido_en
from public.registros_campo
where tipo = 'cacao';
