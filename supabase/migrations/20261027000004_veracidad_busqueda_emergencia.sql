-- =============================================================================
-- GeoOrigen Campo — 04 · Control de veracidad, búsqueda y acceso de emergencia
--
-- 1. Evidencia de captura: GPS automático al abrir y al enviar la encuesta,
--    precisión, ubicación simulada y tiempo de llenado. Inmutable una vez guardada.
-- 2. Alertas automáticas por registro (lejos de la finca, GPS impreciso,
--    ubicación simulada, llenado rápido, varias fincas desde el mismo punto).
-- 3. Origen de cada foto (cámara o galería) con sus datos EXIF.
-- 4. Búsqueda rápida por cédula, nombre, finca… en todo el registro.
-- 5. Acceso de emergencia de GeoOrigen a una organización: solo lectura,
--    con motivo, con vencimiento y registrado para el admin de la organización.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ── 1. Evidencia de captura ───────────────────────────────────────────────────
alter table public.registros
  add column captura_inicio_geom       extensions.geometry(Point, 4326),
  add column captura_inicio_precision  real,          -- metros
  add column captura_inicio_en         timestamptz,   -- hora del GPS
  add column captura_fin_geom          extensions.geometry(Point, 4326),
  add column captura_fin_precision     real,
  add column captura_fin_en            timestamptz,
  add column ubicacion_simulada        boolean not null default false,
  add column dispositivo               jsonb not null default '{}'::jsonb,  -- modelo, sistema, versión de la app
  -- Calculados por el servidor (nadie los escribe directamente)
  add column distancia_finca_m         real,
  add column duracion_s                integer,
  add column alertas                   text[] not null default '{}',
  add column texto_busqueda            text not null default '';

-- Umbrales configurables por formulario
alter table public.formularios
  add column umbral_distancia_m  integer not null default 300,
  add column duracion_minima_s   integer not null default 0;   -- 0 = no revisar

create index registros_captura_geom_idx on public.registros using gist (captura_inicio_geom);
create index registros_alertas_idx      on public.registros using gin (alertas);
create index registros_datos_idx        on public.registros using gin (datos jsonb_path_ops);
create index registros_busqueda_idx     on public.registros using gin (texto_busqueda extensions.gin_trgm_ops);
create index registros_org_creado_idx   on public.registros (org_id, creado_en desc);

-- ── 3. Origen de las fotos ────────────────────────────────────────────────────
alter table public.archivos
  add column origen      text not null default 'camara' check (origen in ('camara', 'galeria', 'firma')),
  add column tomada_en   timestamptz,        -- hora de la toma (cámara) o fecha EXIF (galería)
  add column precision   real,               -- precisión del GPS de la toma, en metros
  add column exif        jsonb not null default '{}'::jsonb;  -- fecha y GPS originales del archivo

-- ── 2. Cálculo de evidencia, alertas y texto de búsqueda ──────────────────────
-- Corre después de los triggers de alta y edición (los triggers van por nombre).
create or replace function app.registro_evidencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_umbral  integer;
  v_minimo  integer;
  v_alertas text[] := '{}';
begin
  -- La evidencia no se puede cambiar una vez guardada (ni el colaborador ni un admin)
  if tg_op = 'UPDATE' then
    if (old.captura_inicio_geom is not null and not extensions.st_equals(new.captura_inicio_geom, old.captura_inicio_geom))
       or (old.captura_inicio_geom is not null and new.captura_inicio_geom is null)
       or old.captura_inicio_en is distinct from new.captura_inicio_en and old.captura_inicio_en is not null
       or old.captura_inicio_precision is distinct from new.captura_inicio_precision and old.captura_inicio_precision is not null
       or (old.captura_fin_geom is not null and (new.captura_fin_geom is null or not extensions.st_equals(new.captura_fin_geom, old.captura_fin_geom)))
       or old.captura_fin_en is distinct from new.captura_fin_en and old.captura_fin_en is not null
       or old.captura_fin_precision is distinct from new.captura_fin_precision and old.captura_fin_precision is not null
       or (old.ubicacion_simulada and not new.ubicacion_simulada)
       or (old.dispositivo <> '{}'::jsonb and new.dispositivo is distinct from old.dispositivo) then
      raise exception 'La evidencia de captura (GPS, hora, dispositivo) no se puede modificar';
    end if;
  end if;

  select umbral_distancia_m, duracion_minima_s into v_umbral, v_minimo
  from public.formularios where id = new.formulario_id;

  -- Distancia entre donde se hizo la encuesta y la ubicación declarada de la finca
  if new.captura_inicio_geom is not null and new.geom is not null then
    new.distancia_finca_m := extensions.st_distance(
      new.captura_inicio_geom::extensions.geography,
      extensions.st_centroid(new.geom)::extensions.geography);
  else
    new.distancia_finca_m := null;
  end if;

  -- Tiempo de llenado según las horas del GPS
  if new.captura_inicio_en is not null and new.captura_fin_en is not null then
    new.duracion_s := extract(epoch from (new.captura_fin_en - new.captura_inicio_en))::integer;
  else
    new.duracion_s := null;
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
  if new.distancia_finca_m is not null and new.distancia_finca_m > v_umbral then
    v_alertas := v_alertas || 'lejos_finca';
  end if;
  if v_minimo > 0 and new.duracion_s is not null and new.duracion_s < v_minimo then
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
  new.alertas := v_alertas;

  -- Texto para la búsqueda rápida: todos los textos del registro, sin tildes y en minúscula
  new.texto_busqueda := coalesce((
    select lower(extensions.unaccent('extensions.unaccent'::regdictionary, string_agg(t #>> '{}', ' ')))
    from jsonb_path_query(new.datos, 'strict $.** ? (@.type() == "string")') as t
  ), '');

  return new;
end;
$$;

create trigger registros_evidencia
  before insert or update on public.registros
  for each row execute function app.registro_evidencia();

-- Permisos: la app escribe la evidencia; los campos calculados solo el servidor
grant insert (captura_inicio_geom, captura_inicio_precision, captura_inicio_en,
              captura_fin_geom, captura_fin_precision, captura_fin_en,
              ubicacion_simulada, dispositivo)
  on public.registros to authenticated;
grant update (captura_inicio_geom, captura_inicio_precision, captura_inicio_en,
              captura_fin_geom, captura_fin_precision, captura_fin_en,
              ubicacion_simulada, dispositivo)
  on public.registros to authenticated;
grant update (umbral_distancia_m, duracion_minima_s) on public.formularios to authenticated;
grant insert (umbral_distancia_m, duracion_minima_s) on public.formularios to authenticated;

-- ── 5. Acceso de emergencia ───────────────────────────────────────────────────
alter table public.miembros
  add column expira_en  timestamptz,   -- null = acceso permanente
  add column motivo     text;

-- Un acceso vencido deja de contar en todas las reglas
create or replace function app.rol_en(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.rol from public.miembros m
  where m.org_id = p_org and m.user_id = auth.uid() and m.activo
    and (m.expira_en is null or m.expira_en > now())
$$;

create or replace function app.comparte_org(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros a
    join public.miembros b on b.org_id = a.org_id
    where a.user_id = auth.uid() and a.activo
      and (a.expira_en is null or a.expira_en > now())
      and b.user_id = p_user
  )
$$;

create table public.accesos_auditoria (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizaciones(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  accion      text not null,
  motivo      text not null,
  expira_en   timestamptz,
  created_at  timestamptz not null default now()
);
create index accesos_auditoria_org_idx on public.accesos_auditoria (org_id, created_at desc);

alter table public.accesos_auditoria enable row level security;
grant select on public.accesos_auditoria to authenticated;

-- Lo ven el admin de la organización y los admins de la plataforma
create policy auditoria_ver on public.accesos_auditoria for select to authenticated
  using (app.rol_en(org_id) = 'admin' or app.es_plataforma_admin());

-- Da acceso de solo lectura a una organización por un tiempo limitado
create or replace function public.acceso_emergencia(p_org uuid, p_motivo text, p_horas integer default 72)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_expira timestamptz;
  v_actual public.miembros;
begin
  if not app.es_plataforma_admin() then
    raise exception 'Solo un administrador de la plataforma puede pedir acceso de emergencia';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'Escribe el motivo del acceso (mínimo 10 caracteres)';
  end if;
  if p_horas < 1 or p_horas > 168 then
    raise exception 'El acceso de emergencia dura entre 1 y 168 horas';
  end if;

  select * into v_actual from public.miembros where org_id = p_org and user_id = auth.uid();
  if found and v_actual.expira_en is null then
    raise exception 'Ya eres miembro permanente de esta organización';
  end if;

  v_expira := now() + make_interval(hours => p_horas);
  insert into public.miembros (org_id, user_id, rol, activo, expira_en, motivo)
  values (p_org, auth.uid(), 'lector', true, v_expira, trim(p_motivo))
  on conflict (org_id, user_id)
  do update set rol = 'lector', activo = true, expira_en = excluded.expira_en, motivo = excluded.motivo;

  insert into public.accesos_auditoria (org_id, user_id, accion, motivo, expira_en)
  values (p_org, auth.uid(), 'acceso_emergencia', trim(p_motivo), v_expira);

  return v_expira;
end;
$$;

revoke execute on function public.acceso_emergencia(uuid, text, integer) from public, anon;
grant execute on function public.acceso_emergencia(uuid, text, integer) to authenticated;
