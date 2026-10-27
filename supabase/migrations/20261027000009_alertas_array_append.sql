-- =============================================================================
-- GeoOrigen Campo — 09 · Corrige "malformed array literal" al guardar registros
--
-- En registro_control() se agregaban alertas con  lista || 'texto' , y Postgres
-- interpretaba el texto como una lista mal escrita. Se usa array_append.
-- La lógica de las alertas no cambia.
-- =============================================================================

create or replace function app.registro_control()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_umbral    integer;
  v_minimo    integer;
  v_distancia real;
  v_duracion  integer;
  v_alertas   text[] := '{}';
begin
  select umbral_distancia_m, duracion_minima_s into v_umbral, v_minimo
  from public.formularios where id = new.formulario_id;

  if new.captura_inicio_geom is not null and new.geom is not null then
    v_distancia := extensions.st_distance(
      new.captura_inicio_geom::extensions.geography,
      extensions.st_centroid(new.geom)::extensions.geography);
  end if;
  if new.captura_inicio_en is not null and new.captura_fin_en is not null then
    v_duracion := extract(epoch from (new.captura_fin_en - new.captura_inicio_en))::integer;
  end if;

  if new.captura_inicio_geom is null then
    v_alertas := array_append(v_alertas, 'sin_gps');
  end if;
  if coalesce(new.captura_inicio_precision, 0) > 50 or coalesce(new.captura_fin_precision, 0) > 50 then
    v_alertas := array_append(v_alertas, 'gps_impreciso');
  end if;
  if new.ubicacion_simulada then
    v_alertas := array_append(v_alertas, 'ubicacion_simulada');
  end if;
  if v_umbral > 0 and v_distancia is not null and v_distancia > v_umbral then
    v_alertas := array_append(v_alertas, 'lejos_finca');
  end if;
  if v_minimo > 0 and v_duracion is not null and v_duracion < v_minimo then
    v_alertas := array_append(v_alertas, 'llenado_rapido');
  end if;
  -- Otra finca distinta (a más de 100 m) encuestada desde el mismo punto (menos de 30 m)
  if new.captura_inicio_geom is not null and new.geom is not null and exists (
    select 1 from public.registros r
    where r.org_id = new.org_id and r.id <> new.id and not r.eliminado
      and r.captura_inicio_geom is not null and r.geom is not null
      and extensions.st_dwithin(r.captura_inicio_geom::extensions.geography,
                                new.captura_inicio_geom::extensions.geography, 30)
      and not extensions.st_dwithin(extensions.st_centroid(r.geom)::extensions.geography,
                                    extensions.st_centroid(new.geom)::extensions.geography, 100)
  ) then
    v_alertas := array_append(v_alertas, 'mismo_punto');
  end if;

  insert into public.registros_control (registro_id, org_id, distancia_finca_m, duracion_s, alertas, calculado_en)
  values (new.id, new.org_id, v_distancia, v_duracion, v_alertas, now())
  on conflict (registro_id) do update set
    distancia_finca_m = excluded.distancia_finca_m,
    duracion_s        = excluded.duracion_s,
    alertas           = excluded.alertas,
    calculado_en      = excluded.calculado_en;
  return null;
end;
$$;
