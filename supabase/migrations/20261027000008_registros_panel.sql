-- =============================================================================
-- GeoOrigen Campo — 08 · Vista de registros para la pantalla Datos del panel
--
-- Une cada registro con sus coordenadas (como números), el control de veracidad
-- y el nombre del técnico. security_invoker = true: la vista aplica las reglas
-- (RLS) de quien consulta, así que cada quien ve solo lo que ya podía ver, y el
-- colaborador sigue sin ver el control (le llega vacío).
-- =============================================================================

create or replace view public.registros_panel with (security_invoker = true) as
select
  r.id, r.org_id, r.formulario_id, r.formulario_version, r.proyecto_id,
  r.estado, r.datos, r.asignado_a, r.creado_por, r.actualizado_por,
  r.creado_en, r.actualizado_en, r.recibido_en, r.revision, r.eliminado, r.texto_busqueda,
  -- Dónde estaba el celular al abrir y al enviar la encuesta
  extensions.st_y(r.captura_inicio_geom) as captura_lat,
  extensions.st_x(r.captura_inicio_geom) as captura_lon,
  r.captura_inicio_precision, r.captura_inicio_en,
  extensions.st_y(r.captura_fin_geom) as captura_fin_lat,
  extensions.st_x(r.captura_fin_geom) as captura_fin_lon,
  r.captura_fin_precision, r.captura_fin_en,
  r.ubicacion_simulada, r.dispositivo,
  -- Ubicación declarada de la finca
  extensions.st_y(extensions.st_centroid(r.geom)) as finca_lat,
  extensions.st_x(extensions.st_centroid(r.geom)) as finca_lon,
  -- Control de veracidad (vacío para quien no puede verlo)
  c.distancia_finca_m, c.duracion_s, coalesce(c.alertas, '{}') as alertas,
  -- Técnico que la hizo
  p.nombre as tecnico_nombre, p.email as tecnico_email
from public.registros r
left join public.registros_control c on c.registro_id = r.id
left join public.perfiles p on p.user_id = r.creado_por;

grant select on public.registros_panel to authenticated;
