-- =============================================================================
-- GeoOrigen Campo — 05 · Control de veracidad oculto para el técnico
--
-- Corrige la 04: distancia a la finca, tiempo de llenado y alertas salen de la
-- tabla registros (que el colaborador puede leer) y pasan a registros_control,
-- que solo leen admin, editor y lector. Los umbrales solo MARCAN para revisión
-- (0 los apaga); nunca impiden guardar ni enviar una encuesta.
-- =============================================================================

-- ── Quitar los datos de control de la tabla que ve el técnico ─────────────────
alter table public.registros
  drop column if exists distancia_finca_m,
  drop column if exists duracion_s,
  drop column if exists alertas;   -- su índice se borra con la columna

-- El trigger de antes de guardar queda solo con: evidencia inmutable + texto de búsqueda
create or replace function app.registro_evidencia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (old.captura_inicio_geom is not null
          and (new.captura_inicio_geom is null or not extensions.st_equals(new.captura_inicio_geom, old.captura_inicio_geom)))
       or (old.captura_inicio_en is not null and new.captura_inicio_en is distinct from old.captura_inicio_en)
       or (old.captura_inicio_precision is not null and new.captura_inicio_precision is distinct from old.captura_inicio_precision)
       or (old.captura_fin_geom is not null
          and (new.captura_fin_geom is null or not extensions.st_equals(new.captura_fin_geom, old.captura_fin_geom)))
       or (old.captura_fin_en is not null and new.captura_fin_en is distinct from old.captura_fin_en)
       or (old.captura_fin_precision is not null and new.captura_fin_precision is distinct from old.captura_fin_precision)
       or (old.ubicacion_simulada and not new.ubicacion_simulada)
       or (old.dispositivo <> '{}'::jsonb and new.dispositivo is distinct from old.dispositivo) then
      raise exception 'La evidencia de captura no se puede modificar';
    end if;
  end if;

  -- Todos los textos del registro, sin tildes y en minúscula
  new.texto_busqueda := coalesce((
    select lower(extensions.unaccent('extensions.unaccent'::regdictionary, string_agg(t #>> '{}', ' ')))
    from jsonb_path_query(new.datos, 'strict $.** ? (@.type() == "string")') as t
  ), '');
  return new;
end;
$$;

comment on column public.formularios.umbral_distancia_m is 'Solo marca para revisión; 0 = no marcar distancia. Nunca bloquea.';
comment on column public.formularios.duracion_minima_s is 'Solo marca para revisión; 0 = no marcar tiempo. Nunca bloquea.';

-- ── Tabla de control (el colaborador no tiene ninguna política sobre ella) ────
create table if not exists public.registros_control (
  registro_id        uuid primary key references public.registros(id) on delete cascade,
  org_id             uuid not null references public.organizaciones(id) on delete cascade,
  distancia_finca_m  real,       -- de donde se hizo la encuesta a la ubicación de la finca
  duracion_s         integer,    -- de abrir a enviar, según la hora del GPS
  alertas            text[] not null default '{}',
  calculado_en       timestamptz not null default now()
);
create index if not exists registros_control_alertas_idx on public.registros_control using gin (alertas);
create index if not exists registros_control_org_idx on public.registros_control (org_id);

alter table public.registros_control enable row level security;
grant select on public.registros_control to authenticated;

drop policy if exists control_ver on public.registros_control;
create policy control_ver on public.registros_control for select to authenticated
  using (app.rol_en(org_id) in ('admin', 'editor', 'lector'));

-- Después de guardar un registro: calcula distancia, tiempo y alertas
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
    v_alertas := v_alertas || 'sin_gps';
  end if;
  if coalesce(new.captura_inicio_precision, 0) > 50 or coalesce(new.captura_fin_precision, 0) > 50 then
    v_alertas := v_alertas || 'gps_impreciso';
  end if;
  if new.ubicacion_simulada then
    v_alertas := v_alertas || 'ubicacion_simulada';
  end if;
  if v_umbral > 0 and v_distancia is not null and v_distancia > v_umbral then
    v_alertas := v_alertas || 'lejos_finca';
  end if;
  if v_minimo > 0 and v_duracion is not null and v_duracion < v_minimo then
    v_alertas := v_alertas || 'llenado_rapido';
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
    v_alertas := v_alertas || 'mismo_punto';
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

drop trigger if exists registros_control on public.registros;
create trigger registros_control
  after insert or update on public.registros
  for each row execute function app.registro_control();

-- Verificación: debe devolver 'ok' en las tres filas
select 'columnas de control fuera de registros' as revision,
       case when not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'registros'
           and column_name in ('alertas', 'distancia_finca_m', 'duracion_s')
       ) then 'ok' else 'FALTA' end as estado
union all
select 'tabla registros_control con RLS',
       case when (select relrowsecurity from pg_class where oid = 'public.registros_control'::regclass)
            then 'ok' else 'FALTA' end
union all
select 'trigger de control',
       case when exists (select 1 from pg_trigger where tgname = 'registros_control')
            then 'ok' else 'FALTA' end;
