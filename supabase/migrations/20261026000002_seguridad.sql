-- =============================================================================
-- GeoOrigen Campo — 02 · Roles, reglas y seguridad (RLS)
-- Regla general: nadie ve ni toca nada fuera de las organizaciones donde es
-- miembro activo, y cada rol solo hace lo que le corresponde.
-- =============================================================================

-- Las funciones auxiliares van en un esquema que la API no expone.
create schema if not exists app;
grant usage on schema app to authenticated;

-- ── Funciones auxiliares ──────────────────────────────────────────────────────

-- Rol del usuario actual en una organización (null si no es miembro activo)
create or replace function app.rol_en(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.rol from public.miembros m
  where m.org_id = p_org and m.user_id = auth.uid() and m.activo
$$;

create or replace function app.es_plataforma_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plataforma_admins where user_id = auth.uid())
$$;

-- ¿El usuario actual comparte alguna organización con otro usuario?
create or replace function app.comparte_org(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros a
    join public.miembros b on b.org_id = a.org_id
    where a.user_id = auth.uid() and a.activo and b.user_id = p_user
  )
$$;

create or replace function app.org_de_formulario(p_form uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.formularios where id = p_form
$$;

-- Admin/editor/lector ven todos los formularios de su org.
-- Un colaborador ve los activos que se le asignaron, o los que no tienen asignaciones.
create or replace function app.puede_ver_formulario(p_form uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case app.rol_en(f.org_id)
    when 'admin' then true
    when 'editor' then true
    when 'lector' then true
    when 'colaborador' then f.activo and (
      exists (select 1 from public.formulario_asignaciones a
              where a.formulario_id = f.id and a.user_id = auth.uid())
      or not exists (select 1 from public.formulario_asignaciones a
                     where a.formulario_id = f.id))
    else false
  end
  from public.formularios f where f.id = p_form
$$;

grant execute on all functions in schema app to authenticated;

-- ── Triggers ──────────────────────────────────────────────────────────────────

-- Crear el perfil cuando se crea un usuario en Auth
create or replace function app.crear_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (user_id, email, nombre)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nombre', ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function app.crear_perfil();

create or replace function app.tocar_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger formularios_updated_at
  before update on public.formularios
  for each row execute function app.tocar_updated_at();

-- Al crear un registro: el servidor fija autor, revisión y hora de recibido
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
  if app.rol_en(new.org_id) = 'colaborador' and new.estado not in ('borrador', 'enviado') then
    raise exception 'Un colaborador solo puede dejar registros en borrador o enviado';
  end if;
  return new;
end;
$$;

create trigger registros_al_insertar
  before insert on public.registros
  for each row execute function app.registro_al_insertar();

-- Al modificar un registro: guarda la versión anterior en el historial,
-- sube la revisión y bloquea cambios que no le tocan a cada rol.
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

create trigger registros_al_actualizar
  before update on public.registros
  for each row execute function app.registro_al_actualizar();

-- ── Funciones que llama el panel (RPC) ────────────────────────────────────────

-- Publica el borrador del formulario como una nueva versión congelada
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

  v_nueva := coalesce(v_form.version_actual, 0) + 1;
  insert into public.formulario_versiones (formulario_id, version, schema, publicado_por)
  values (v_form.id, v_nueva, v_form.schema, auth.uid());
  update public.formularios set version_actual = v_nueva where id = v_form.id;
  return v_nueva;
end;
$$;

-- Crea una organización y deja al creador como admin (solo admins de plataforma)
create or replace function public.crear_organizacion(p_nombre text, p_slug text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not app.es_plataforma_admin() then
    raise exception 'Solo un administrador de la plataforma puede crear organizaciones';
  end if;
  insert into public.organizaciones (nombre, slug) values (p_nombre, p_slug) returning id into v_id;
  insert into public.miembros (org_id, user_id, rol) values (v_id, auth.uid(), 'admin');
  return v_id;
end;
$$;

revoke execute on function public.publicar_formulario(uuid) from public, anon;
revoke execute on function public.crear_organizacion(text, text) from public, anon;
grant execute on function public.publicar_formulario(uuid) to authenticated;
grant execute on function public.crear_organizacion(text, text) to authenticated;

-- ── Permisos de tabla (el proyecto no expone tablas automáticamente) ───────────
revoke all on all tables in schema public from anon, authenticated;

grant select, update (nombre, activa)                 on public.organizaciones to authenticated;
grant select, update (nombre)                         on public.perfiles to authenticated;
grant select, insert, update (rol, activo), delete    on public.miembros to authenticated;
grant select, insert, update (nombre, descripcion, activo), delete on public.proyectos to authenticated;
grant select,
      insert (org_id, nombre, descripcion, icono, activo, schema, estados),
      update (nombre, descripcion, icono, activo, schema, estados),
      delete                                          on public.formularios to authenticated;
grant select                                          on public.formulario_versiones to authenticated;
grant select, insert, delete                          on public.formulario_asignaciones to authenticated;
grant select,
      insert (id, org_id, formulario_id, formulario_version, proyecto_id, estado, datos, geom,
              asignado_a, creado_en, actualizado_en),
      update (formulario_version, proyecto_id, estado, datos, geom, asignado_a, actualizado_en, eliminado)
                                                      on public.registros to authenticated;
grant select                                          on public.registros_historial to authenticated;
grant select, insert, delete                          on public.archivos to authenticated;
-- plataforma_admins: sin permisos (solo la leen funciones internas)

alter table public.formularios alter column created_by set default auth.uid();
alter table public.archivos alter column creado_por set default auth.uid();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.organizaciones          enable row level security;
alter table public.plataforma_admins       enable row level security;
alter table public.perfiles                enable row level security;
alter table public.miembros                enable row level security;
alter table public.proyectos               enable row level security;
alter table public.formularios             enable row level security;
alter table public.formulario_versiones    enable row level security;
alter table public.formulario_asignaciones enable row level security;
alter table public.registros               enable row level security;
alter table public.registros_historial     enable row level security;
alter table public.archivos                enable row level security;

-- Organizaciones
create policy org_ver on public.organizaciones for select to authenticated
  using (app.rol_en(id) is not null or app.es_plataforma_admin());
create policy org_editar on public.organizaciones for update to authenticated
  using (app.rol_en(id) = 'admin') with check (app.rol_en(id) = 'admin');

-- Perfiles: el propio y los de compañeros de organización
create policy perfil_ver on public.perfiles for select to authenticated
  using (user_id = auth.uid() or app.comparte_org(user_id));
create policy perfil_editar on public.perfiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Miembros: cualquiera ve su equipo; solo el admin lo gestiona
create policy miembros_ver on public.miembros for select to authenticated
  using (user_id = auth.uid() or app.rol_en(org_id) is not null);
create policy miembros_crear on public.miembros for insert to authenticated
  with check (app.rol_en(org_id) = 'admin');
create policy miembros_editar on public.miembros for update to authenticated
  using (app.rol_en(org_id) = 'admin') with check (app.rol_en(org_id) = 'admin');
create policy miembros_borrar on public.miembros for delete to authenticated
  using (app.rol_en(org_id) = 'admin' and user_id <> auth.uid());

-- Proyectos
create policy proyectos_ver on public.proyectos for select to authenticated
  using (app.rol_en(org_id) is not null);
create policy proyectos_crear on public.proyectos for insert to authenticated
  with check (app.rol_en(org_id) in ('admin', 'editor'));
create policy proyectos_editar on public.proyectos for update to authenticated
  using (app.rol_en(org_id) in ('admin', 'editor')) with check (app.rol_en(org_id) in ('admin', 'editor'));
create policy proyectos_borrar on public.proyectos for delete to authenticated
  using (app.rol_en(org_id) = 'admin');

-- Formularios
create policy formularios_ver on public.formularios for select to authenticated
  using (app.puede_ver_formulario(id));
create policy formularios_crear on public.formularios for insert to authenticated
  with check (app.rol_en(org_id) in ('admin', 'editor'));
create policy formularios_editar on public.formularios for update to authenticated
  using (app.rol_en(org_id) in ('admin', 'editor')) with check (app.rol_en(org_id) in ('admin', 'editor'));
create policy formularios_borrar on public.formularios for delete to authenticated
  using (app.rol_en(org_id) = 'admin');

create policy versiones_ver on public.formulario_versiones for select to authenticated
  using (app.puede_ver_formulario(formulario_id));

create policy asignaciones_ver on public.formulario_asignaciones for select to authenticated
  using (user_id = auth.uid() or app.rol_en(app.org_de_formulario(formulario_id)) in ('admin', 'editor'));
create policy asignaciones_crear on public.formulario_asignaciones for insert to authenticated
  with check (app.rol_en(app.org_de_formulario(formulario_id)) in ('admin', 'editor')
              and exists (select 1 from public.miembros m
                          where m.user_id = formulario_asignaciones.user_id
                            and m.org_id = app.org_de_formulario(formulario_id)));
create policy asignaciones_borrar on public.formulario_asignaciones for delete to authenticated
  using (app.rol_en(app.org_de_formulario(formulario_id)) in ('admin', 'editor'));

-- Registros
create policy registros_ver on public.registros for select to authenticated
  using (
    app.rol_en(org_id) in ('admin', 'editor', 'lector')
    or (app.rol_en(org_id) = 'colaborador' and (creado_por = auth.uid() or asignado_a = auth.uid()))
  );
create policy registros_crear on public.registros for insert to authenticated
  with check (
    app.rol_en(org_id) in ('admin', 'editor', 'colaborador')
    and app.puede_ver_formulario(formulario_id)
  );
create policy registros_editar on public.registros for update to authenticated
  using (
    app.rol_en(org_id) in ('admin', 'editor')
    or (app.rol_en(org_id) = 'colaborador' and (creado_por = auth.uid() or asignado_a = auth.uid()))
  )
  with check (
    app.rol_en(org_id) in ('admin', 'editor')
    or (app.rol_en(org_id) = 'colaborador' and (creado_por = auth.uid() or asignado_a = auth.uid()))
  );
-- Sin política de borrado: se marca 'eliminado' (y queda en el historial)

-- Historial: visible si el registro es visible
create policy historial_ver on public.registros_historial for select to authenticated
  using (exists (select 1 from public.registros r where r.id = registro_id));

-- Archivos
create policy archivos_ver on public.archivos for select to authenticated
  using (exists (select 1 from public.registros r where r.id = registro_id));
create policy archivos_crear on public.archivos for insert to authenticated
  with check (
    creado_por = auth.uid()
    and exists (select 1 from public.registros r where r.id = registro_id and r.org_id = archivos.org_id)
  );
create policy archivos_borrar on public.archivos for delete to authenticated
  using (creado_por = auth.uid() or app.rol_en(org_id) in ('admin', 'editor'));
