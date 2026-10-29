-- =============================================================================
-- GeoOrigen Campo — 10 · No rechazar encuestas de campo + ajustes de seguridad
--
-- 1. Una encuesta hecha sin señal se acepta aunque, mientras tanto, el admin
--    haya desactivado o desasignado el formulario (antes quedaba atascada en el
--    celular para siempre).
-- 2. Un colaborador ya no puede modificar encuestas ya enviadas, revisadas o aprobadas,
--    salvo que un admin o editor la devuelva para corregir (estado rechazado). (La app
--    lo impedía, el servidor no). El mensaje empieza con BLOQUEADA: la app lo reconoce.
-- 3. Un colaborador no puede crear encuestas asignadas a otra persona.
-- 4. Solo admin, editor y colaborador suben fotos (el lector y el acceso de
--    emergencia son de solo lectura).
-- 5. Las fotos y firmas subidas solo las borra un admin o editor: el técnico no
--    puede borrar evidencia.
-- =============================================================================

-- ── 1. Aceptar encuestas de formularios desactivados o desasignados ───────────
-- La organización del formulario ya la garantiza la llave (formulario_id, org_id).
drop policy if exists registros_crear on public.registros;
create policy registros_crear on public.registros for insert to authenticated
  with check (app.rol_en(org_id) in ('admin', 'editor', 'colaborador'));

-- ── 2 y 3. Reglas del colaborador al crear y al editar ────────────────────────
create or replace function app.registro_al_insertar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_estados jsonb;
begin
  new.creado_por      := auth.uid();
  new.actualizado_por := auth.uid();
  new.revision        := 1;
  new.recibido_en     := now();

  select estados into v_estados from public.formularios where id = new.formulario_id;
  if not exists (select 1 from jsonb_array_elements(v_estados) e where e->>'valor' = new.estado) then
    raise exception 'Estado "%" no existe en este formulario', new.estado;
  end if;
  if app.rol_en(new.org_id) = 'colaborador' then
    if new.estado not in ('borrador', 'enviado') then
      raise exception 'Un colaborador solo puede dejar registros en borrador o enviado';
    end if;
    new.asignado_a := null;
  end if;
  return new;
end;
$$;

create or replace function app.registro_al_actualizar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rol text := app.rol_en(old.org_id);
  v_estados jsonb;
begin
  if new.id <> old.id or new.org_id <> old.org_id or new.creado_por <> old.creado_por
     or new.formulario_id <> old.formulario_id or new.creado_en <> old.creado_en then
    raise exception 'No se puede cambiar el id, la organización, el formulario, el autor ni la fecha de creación';
  end if;

  if v_rol = 'colaborador' then
    -- Una vez enviada y sincronizada, solo se corrige si un admin o editor la devuelve (rechazado)
    if old.estado not in ('borrador', 'rechazado') then
      raise exception 'BLOQUEADA: la encuesta está % y el colaborador no puede modificarla', old.estado;
    end if;
    if new.estado not in ('borrador', 'enviado') and new.estado <> old.estado then
      raise exception 'Un colaborador solo puede dejar registros en borrador o enviado';
    end if;
    if new.asignado_a is distinct from old.asignado_a then
      raise exception 'Un colaborador no puede reasignar registros';
    end if;
    if new.eliminado <> old.eliminado then
      raise exception 'Un colaborador no puede eliminar registros';
    end if;
  end if;

  if new.estado <> old.estado then
    select estados into v_estados from public.formularios where id = new.formulario_id;
    if not exists (select 1 from jsonb_array_elements(v_estados) e where e->>'valor' = new.estado) then
      raise exception 'Estado "%" no existe en este formulario', new.estado;
    end if;
  end if;

  insert into public.registros_historial
    (registro_id, org_id, revision, estado, datos, geom, cambiado_por, cambiado_en)
  values
    (old.id, old.org_id, old.revision, old.estado, old.datos, old.geom, old.actualizado_por, old.recibido_en);

  new.revision        := old.revision + 1;
  new.actualizado_por := auth.uid();
  new.recibido_en     := now();
  return new;
end;
$$;

-- ── 4. Subir fotos: solo quien captura o administra ───────────────────────────
drop policy if exists archivos_crear on public.archivos;
create policy archivos_crear on public.archivos for insert to authenticated
  with check (
    creado_por = auth.uid()
    and app.rol_en(org_id) in ('admin', 'editor', 'colaborador')
    and exists (select 1 from public.registros r where r.id = registro_id and r.org_id = archivos.org_id)
  );

drop policy if exists campo_archivos_subir on storage.objects;
create policy campo_archivos_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'campo-archivos'
    and app.rol_en(((storage.foldername(name))[1])::uuid) in ('admin', 'editor', 'colaborador')
    and exists (
      select 1 from public.registros r
      where r.org_id::text = (storage.foldername(name))[1]
        and r.id::text     = (storage.foldername(name))[2]
    )
  );

-- ── 5. Borrar fotos: solo admin o editor ──────────────────────────────────────
drop policy if exists archivos_borrar on public.archivos;
create policy archivos_borrar on public.archivos for delete to authenticated
  using (app.rol_en(org_id) in ('admin', 'editor'));

drop policy if exists campo_archivos_borrar on storage.objects;
create policy campo_archivos_borrar on storage.objects for delete to authenticated
  using (
    bucket_id = 'campo-archivos'
    and app.rol_en(((storage.foldername(name))[1])::uuid) in ('admin', 'editor')
  );

-- Verificación: debe devolver 'ok' en todas las filas
select 'registros_crear sin exigir formulario activo' as revision,
       case when exists (select 1 from pg_policies where policyname = 'registros_crear'
                         and qual is null and with_check not like '%puede_ver_formulario%')
            then 'ok' else 'FALTA' end as estado
union all
select 'colaborador no edita aprobadas',
       case when (select prosrc from pg_proc where proname = 'registro_al_actualizar') like '%BLOQUEADA%'
            then 'ok' else 'FALTA' end
union all
select 'solo admin/editor borran fotos',
       case when (select qual from pg_policies where policyname = 'archivos_borrar') not like '%creado_por%'
            then 'ok' else 'FALTA' end;
