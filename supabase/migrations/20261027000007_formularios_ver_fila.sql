-- =============================================================================
-- GeoOrigen Campo — 07 · Corrige "new row violates row-level security policy
-- for table formularios" al crear un formulario desde el panel.
--
-- La regla de lectura llamaba a puede_ver_formulario(id), que vuelve a buscar
-- el formulario en la tabla. Al crear (INSERT … RETURNING) la fila nueva aún no
-- es visible para esa búsqueda, así que la regla fallaba. Ahora la regla recibe
-- los datos de la propia fila y no necesita buscarla.
-- =============================================================================

create or replace function app.puede_ver_formulario_fila(p_id uuid, p_org uuid, p_activo boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select case app.rol_en(p_org)
    when 'admin' then true
    when 'editor' then true
    when 'lector' then true
    when 'colaborador' then p_activo and (
      exists (select 1 from public.formulario_asignaciones a
              where a.formulario_id = p_id and a.user_id = auth.uid())
      or not exists (select 1 from public.formulario_asignaciones a
                     where a.formulario_id = p_id))
    else false
  end
$$;

grant execute on function app.puede_ver_formulario_fila(uuid, uuid, boolean) to authenticated;

-- La versión por id (la usan versiones y registros, cuyo formulario ya existe)
-- queda igual, pero delegando en la nueva para no tener la regla repetida.
create or replace function app.puede_ver_formulario(p_form uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select app.puede_ver_formulario_fila(f.id, f.org_id, f.activo)
    from public.formularios f where f.id = p_form
  ), false)
$$;

drop policy if exists formularios_ver on public.formularios;
create policy formularios_ver on public.formularios for select to authenticated
  using (app.puede_ver_formulario_fila(id, org_id, activo));
