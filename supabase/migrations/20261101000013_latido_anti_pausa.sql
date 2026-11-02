-- =============================================================================
-- GeoOrigen Campo — 13 · Latido diario para que Supabase no pause el proyecto
--
-- En el plan gratis, Supabase pausa el proyecto tras unos días sin actividad.
-- Solo leer no basta: una tarea diaria de GitHub llama a public.latido(), que
-- ESCRIBE en la base (actualiza la fecha y suma 1 a un contador).
-- La tabla vive en el esquema "app" (no expuesto por la API) y la función solo
-- toca esa fila: no lee ni cambia ningún dato de las organizaciones.
-- =============================================================================

create table if not exists app.latidos (
  id      integer primary key default 1 check (id = 1),   -- una sola fila
  ultimo  timestamptz not null default now(),
  veces   bigint not null default 0
);

create or replace function public.latido()
returns timestamptz language sql security definer set search_path = '' as $$
  insert into app.latidos (id, ultimo, veces) values (1, now(), 1)
  on conflict (id) do update set ultimo = now(), veces = app.latidos.veces + 1
  returning ultimo
$$;

-- La llama la tarea de GitHub con la llave pública: solo puede hacer esto
revoke execute on function public.latido() from public;
grant execute on function public.latido() to anon, authenticated;

-- Verificación: debe devolver la fecha y hora de ahora
select public.latido() as latido_registrado;
