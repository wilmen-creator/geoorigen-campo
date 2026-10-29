-- =============================================================================
-- GeoOrigen Campo — 12 · Licencias por organización
--
-- Cada asociación compra una licencia: plan, fecha de vencimiento y máximo de
-- usuarios (por defecto 2: un administrador y uno de campo). GeoOrigen (el
-- administrador de la plataforma) las crea y renueva, pero NO ve sus datos: solo
-- conteos y espacio usado; para entrar necesita el acceso de emergencia (04).
--
-- Licencia vencida o organización suspendida = solo consulta: se ven los datos,
-- pero no se exportan (lo bloquea el panel) ni se crean formularios, usuarios ni
-- encuestas nuevas (lo bloquea esta migración). Las
-- encuestas hechas en campo ANTES del vencimiento siempre se aceptan, para que
-- nada capturado se pierda. Organización sin fecha ni límite = sin restricción.
-- =============================================================================

alter table public.organizaciones
  add column if not exists plan            text not null default 'mensual',
  add column if not exists licencia_vence  date,      -- null = no vence (GeoOrigen)
  add column if not exists max_usuarios    integer,   -- null = sin límite
  add column if not exists contacto        text not null default '',
  add column if not exists notas           text not null default '';

-- El admin de una asociación solo cambia el nombre: activar, plan y licencia son de GeoOrigen
revoke update on public.organizaciones from authenticated;
grant update (nombre) on public.organizaciones to authenticated;

-- ── ¿La organización puede escribir? ──────────────────────────────────────────
create or replace function app.org_vigente(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select o.activa and (o.licencia_vence is null or o.licencia_vence >= current_date)
    from public.organizaciones o where o.id = p_org
  ), false)
$$;

-- ¿Una encuesta hecha en esta fecha está cubierta por la licencia?
create or replace function app.captura_cubierta(p_org uuid, p_creada timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select o.activa and (o.licencia_vence is null or p_creada::date <= o.licencia_vence)
    from public.organizaciones o where o.id = p_org
  ), false)
$$;

grant execute on function app.org_vigente(uuid), app.captura_cubierta(uuid, timestamptz) to authenticated;

-- ── Encuestas: se aceptan las capturadas dentro de la licencia ────────────────
create or replace function app.licencia_registros()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if app.org_vigente(new.org_id) then
    return new;
  end if;
  -- Encuestas de campo hechas antes del vencimiento: se aceptan (nunca se pierden)
  if app.rol_en(new.org_id) = 'colaborador' and app.captura_cubierta(new.org_id, new.creado_en) then
    return new;
  end if;
  raise exception 'LICENCIA: la licencia de esta organización está vencida o suspendida. Lo capturado sigue guardado en el celular; se subirá cuando se renueve.';
end;
$$;

drop trigger if exists registros_licencia on public.registros;
create trigger registros_licencia
  before insert or update on public.registros
  for each row execute function app.licencia_registros();

-- ── Formularios y miembros: solo con licencia vigente ─────────────────────────
create or replace function app.licencia_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Desactivar a alguien (liberar un cupo) siempre se puede; el acceso de emergencia también
  if tg_table_name = 'miembros' and (not new.activo or new.expira_en is not null) then
    return new;
  end if;
  if not app.org_vigente(new.org_id) then
    raise exception 'LICENCIA: la licencia de esta organización está vencida o suspendida (solo lectura). Contacta a GeoOrigen para renovarla.';
  end if;
  return new;
end;
$$;

drop trigger if exists formularios_licencia on public.formularios;
create trigger formularios_licencia
  before insert or update on public.formularios
  for each row execute function app.licencia_org();

drop trigger if exists miembros_licencia on public.miembros;
create trigger miembros_licencia
  before insert or update on public.miembros
  for each row execute function app.licencia_org();

-- ── Máximo de usuarios del plan ───────────────────────────────────────────────
-- Cuentan los miembros activos permanentes (el acceso de emergencia no ocupa cupo).
create or replace function app.limite_usuarios()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
  v_usados integer;
begin
  if not new.activo or new.expira_en is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.activo and old.expira_en is null then
    return new;  -- ya ocupaba su cupo (p. ej., cambio de rol)
  end if;
  select max_usuarios into v_max from public.organizaciones where id = new.org_id;
  if v_max is null then
    return new;
  end if;
  select count(*) into v_usados from public.miembros
  where org_id = new.org_id and activo and expira_en is null and user_id <> new.user_id;
  if v_usados >= v_max then
    raise exception 'LIMITE_USUARIOS: el plan de esta organización permite % usuario(s). Para agregar más, contacta a GeoOrigen.', v_max;
  end if;
  return new;
end;
$$;

drop trigger if exists miembros_limite on public.miembros;
create trigger miembros_limite
  before insert or update on public.miembros
  for each row execute function app.limite_usuarios();

-- Publicar también exige licencia vigente
create or replace function public.publicar_formulario(p_formulario uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_form public.formularios;
  v_nueva integer;
begin
  select * into v_form from public.formularios where id = p_formulario for update;
  if not found then
    raise exception 'Formulario no encontrado';
  end if;
  if coalesce(app.rol_en(v_form.org_id), '') not in ('admin', 'editor') then
    raise exception 'Sin permiso para publicar este formulario';
  end if;
  if not app.org_vigente(v_form.org_id) then
    raise exception 'LICENCIA: la licencia de esta organización está vencida o suspendida (solo lectura).';
  end if;

  v_nueva := coalesce(v_form.version_actual, 0) + 1;
  insert into public.formulario_versiones (formulario_id, version, schema, publicado_por)
  values (v_form.id, v_nueva, v_form.schema, auth.uid());
  update public.formularios set version_actual = v_nueva where id = v_form.id;
  return v_nueva;
end;
$$;

-- ── Funciones de la pantalla "Plataforma" (solo GeoOrigen) ────────────────────
-- Devuelven conteos, nunca el contenido de las encuestas.
create or replace function public.plataforma_organizaciones()
returns table (
  id uuid, nombre text, slug text, activa boolean, plan text, licencia_vence date,
  max_usuarios integer, contacto text, notas text, created_at timestamptz,
  usuarios bigint, admins bigint, encuestas bigint, ultima_encuesta timestamptz, almacenamiento_bytes bigint,
  soy_miembro boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.es_plataforma_admin() then
    raise exception 'Solo el administrador de la plataforma';
  end if;
  return query
  select o.id, o.nombre, o.slug, o.activa, o.plan, o.licencia_vence, o.max_usuarios, o.contacto, o.notas, o.created_at,
    (select count(*) from public.miembros m where m.org_id = o.id and m.activo and m.expira_en is null),
    (select count(*) from public.miembros m where m.org_id = o.id and m.activo and m.expira_en is null and m.rol = 'admin'),
    (select count(*) from public.registros r where r.org_id = o.id and not r.eliminado),
    (select max(r.recibido_en) from public.registros r where r.org_id = o.id),
    (select coalesce(sum(a.bytes), 0)::bigint from public.archivos a where a.org_id = o.id),
    exists (select 1 from public.miembros m where m.org_id = o.id and m.user_id = auth.uid() and m.activo
            and (m.expira_en is null or m.expira_en > now()))
  from public.organizaciones o
  order by o.nombre;
end;
$$;

-- Crea (p_id null) o actualiza una organización y su licencia. Quien la crea NO queda como miembro.
create or replace function public.plataforma_guardar_org(
  p_id uuid, p_nombre text, p_slug text, p_activa boolean, p_plan text,
  p_licencia_vence date, p_max_usuarios integer, p_contacto text, p_notas text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not app.es_plataforma_admin() then
    raise exception 'Solo el administrador de la plataforma';
  end if;
  if length(trim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe el nombre de la organización';
  end if;
  if p_max_usuarios is not null and p_max_usuarios < 1 then
    raise exception 'El máximo de usuarios debe ser 1 o más (vacío = sin límite)';
  end if;
  if p_id is null then
    insert into public.organizaciones (nombre, slug, activa, plan, licencia_vence, max_usuarios, contacto, notas)
    values (trim(p_nombre), lower(trim(p_slug)), coalesce(p_activa, true), coalesce(p_plan, 'mensual'),
            p_licencia_vence, p_max_usuarios, coalesce(p_contacto, ''), coalesce(p_notas, ''))
    returning id into v_id;
  else
    update public.organizaciones set
      nombre = trim(p_nombre), slug = lower(trim(p_slug)), activa = coalesce(p_activa, true),
      plan = coalesce(p_plan, 'mensual'), licencia_vence = p_licencia_vence, max_usuarios = p_max_usuarios,
      contacto = coalesce(p_contacto, ''), notas = coalesce(p_notas, '')
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Organización no encontrada';
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.plataforma_organizaciones() from public, anon;
revoke execute on function public.plataforma_guardar_org(uuid, text, text, boolean, text, date, integer, text, text) from public, anon;
grant execute on function public.plataforma_organizaciones() to authenticated;
grant execute on function public.plataforma_guardar_org(uuid, text, text, boolean, text, date, integer, text, text) to authenticated;

-- Verificación: debe devolver 'ok' en todas las filas
select 'columnas de licencia' as revision,
       case when exists (select 1 from information_schema.columns where table_schema = 'public'
                         and table_name = 'organizaciones' and column_name = 'licencia_vence')
            then 'ok' else 'FALTA' end as estado
union all
select 'triggers de licencia y límite',
       case when (select count(*) from pg_trigger where tgname in
                  ('registros_licencia', 'formularios_licencia', 'miembros_licencia', 'miembros_limite')) = 4
            then 'ok' else 'FALTA' end
union all
select 'funciones de plataforma',
       case when exists (select 1 from pg_proc where proname = 'plataforma_organizaciones')
             and exists (select 1 from pg_proc where proname = 'plataforma_guardar_org')
            then 'ok' else 'FALTA' end;
