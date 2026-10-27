-- =============================================================================
-- GeoOrigen Campo — DATOS DE DEMOSTRACIÓN (inventados, solo para probar el panel)
--
-- Crea 30 encuestas falsas del formulario publicado "Prueba", alrededor de
-- Rioblanco (Tolima), repartidas entre los miembros de su organización.
-- Algunas traen alertas a propósito: lejos de la finca, GPS impreciso,
-- ubicación simulada, llenado rápido y varias fincas desde el mismo punto.
--
-- Todas llevan datos->>'_demo' = 'si'. Para BORRARLAS:
--   delete from public.registros where datos->>'_demo' = 'si';
-- =============================================================================

do $$
declare
  v_form      record;
  v_miembros  record;
  v_uids      uuid[];
  v_roles     text[];
  v_n         integer;
  i           integer;
  k           integer;
  v_finca_lat double precision;
  v_finca_lon double precision;
  v_lat       double precision;
  v_lon       double precision;
  v_prev_lat  double precision;
  v_prev_lon  double precision;
  v_inicio    timestamptz;
  v_duracion  integer;
  v_estado    text;
  v_precision real;
  nombres text[] := array['María Gómez', 'José Rodríguez', 'Ana Lucía Peña', 'Luis Fernando Ortiz', 'Carmen Rojas',
    'Pedro Antonio Díaz', 'Rosa Elena Vargas', 'Jorge Castaño', 'Gloria Patiño', 'Hernán Sánchez',
    'Blanca Nieves Torres', 'Álvaro Murillo', 'Martha Cecilia Ruiz', 'Fabio Londoño', 'Luz Marina Quintero'];
  estados text[] := array['enviado', 'enviado', 'revisado', 'aprobado', 'rechazado'];
begin
  select f.id, f.org_id, f.version_actual into v_form
  from public.formularios f
  where f.nombre = 'Prueba' and f.version_actual is not null
  order by f.created_at limit 1;
  if not found then
    raise exception 'No encontré un formulario publicado llamado "Prueba"';
  end if;

  select array_agg(m.user_id order by m.rol), array_agg(m.rol order by m.rol) into v_uids, v_roles
  from public.miembros m where m.org_id = v_form.org_id and m.activo;
  v_n := array_length(v_uids, 1);

  for i in 1..30 loop
    k := 1 + (i % v_n);
    -- Los triggers usan auth.uid(): se simula que la encuesta la sube ese miembro
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_uids[k], 'role', 'authenticated')::text, true);

    v_finca_lat := 3.53 + (random() - 0.5) * 0.12;
    v_finca_lon := -75.64 + (random() - 0.5) * 0.12;
    if i % 7 = 0 then
      -- Encuesta hecha a ~1 km de la finca
      v_lat := v_finca_lat + 0.009; v_lon := v_finca_lon + 0.004;
    elsif i % 10 = 0 and v_prev_lat is not null then
      -- Misma ubicación de captura que la encuesta anterior, pero otra finca
      v_lat := v_prev_lat; v_lon := v_prev_lon;
    else
      v_lat := v_finca_lat + (random() - 0.5) * 0.0008;
      v_lon := v_finca_lon + (random() - 0.5) * 0.0008;
    end if;
    v_prev_lat := v_lat; v_prev_lon := v_lon;

    v_inicio := now() - make_interval(days => i % 20, hours => (random() * 8)::int);
    v_duracion := case when i % 9 = 0 then 140 else 900 + (random() * 1500)::int end;
    v_precision := case when i % 11 = 0 then 85 else 4 + random() * 15 end;
    v_estado := case when v_roles[k] = 'colaborador' then 'enviado' else estados[1 + (i % 5)] end;

    insert into public.registros (
      id, org_id, formulario_id, formulario_version, estado, datos, geom,
      creado_en, actualizado_en,
      captura_inicio_geom, captura_inicio_precision, captura_inicio_en,
      captura_fin_geom, captura_fin_precision, captura_fin_en,
      ubicacion_simulada, dispositivo
    ) values (
      gen_random_uuid(), v_form.org_id, v_form.id, v_form.version_actual, v_estado,
      jsonb_build_object(
        'nombre', nombres[1 + (i % array_length(nombres, 1))],
        'cedula', (10000000 + (random() * 89999999)::int)::text,
        '_demo', 'si'),
      extensions.st_setsrid(extensions.st_makepoint(v_finca_lon, v_finca_lat), 4326),
      v_inicio, v_inicio + make_interval(secs => v_duracion),
      extensions.st_setsrid(extensions.st_makepoint(v_lon, v_lat), 4326), v_precision, v_inicio,
      extensions.st_setsrid(extensions.st_makepoint(v_lon + 0.00005, v_lat), 4326), v_precision,
      v_inicio + make_interval(secs => v_duracion),
      i = 13, '{"modelo": "Celular de demostración", "app": "demo"}'::jsonb
    );
  end loop;
end $$;

-- Resumen: cuántas quedaron y con qué alertas
select r.estado, count(*) as encuestas,
       count(*) filter (where cardinality(c.alertas) > 0) as con_alertas
from public.registros r
left join public.registros_control c on c.registro_id = r.id
where r.datos->>'_demo' = 'si'
group by r.estado order by r.estado;
