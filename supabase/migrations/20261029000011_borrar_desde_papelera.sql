-- =============================================================================
-- GeoOrigen Campo — 11 · Borrar registros para siempre desde la papelera
--
-- "Eliminar" en el panel solo marca el registro (eliminado = true) y lo manda a
-- la papelera, de donde se puede restaurar. Desde la papelera, solo un ADMIN
-- puede borrarlo definitivamente (por ejemplo, los registros de prueba). Solo se
-- borra lo que ya está en la papelera: nunca un registro vigente de un golpe.
-- Sus fotos (fichas), historial y control se borran en cascada; los archivos de
-- Storage los borra el panel antes (la regla de Storage ya lo permite al admin).
-- =============================================================================

grant delete on public.registros to authenticated;

drop policy if exists registros_borrar on public.registros;
create policy registros_borrar on public.registros for delete to authenticated
  using (eliminado and app.rol_en(org_id) = 'admin');

-- Verificación: debe devolver 'ok'
select 'borrado definitivo solo admin y desde la papelera' as revision,
       case when exists (select 1 from pg_policies where policyname = 'registros_borrar'
                         and qual like '%eliminado%' and qual like '%admin%')
            then 'ok' else 'FALTA' end as estado;
