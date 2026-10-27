-- =============================================================================
-- GeoOrigen Campo — 06 · ¿El usuario actual administra la plataforma?
-- El panel la usa para mostrar u ocultar "Crear organización" y el acceso de
-- emergencia. Solo responde sí/no sobre uno mismo.
-- =============================================================================

create or replace function public.soy_plataforma_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select app.es_plataforma_admin()
$$;

revoke execute on function public.soy_plataforma_admin() from public, anon;
grant execute on function public.soy_plataforma_admin() to authenticated;
