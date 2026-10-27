-- =============================================================================
-- GeoOrigen Campo — 01 · Modelo base
-- Plataforma de captura en campo (estilo Fulcrum / Zoho Forms).
-- Todo es un formulario: café, cacao y cualquier otro se definen como esquema.
-- Proyecto Supabase propio (no compartido con el sitio).
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- ── Organizaciones (GeoOrigen, asociaciones, clientes) ─────────────────────────
create table public.organizaciones (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Administradores de toda la plataforma (pueden crear organizaciones).
-- No se expone por la API: solo la leen funciones security definer.
create table public.plataforma_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ── Perfil de cada usuario ────────────────────────────────────────────────────
create table public.perfiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null default '',
  email       text not null default '',
  created_at  timestamptz not null default now()
);

-- ── Miembros y roles por organización ─────────────────────────────────────────
--   admin        gestiona miembros, formularios y todos los registros
--   editor       crea/edita formularios y revisa todos los registros
--   colaborador  captura en campo; ve solo sus registros y los asignados
--   lector       solo lectura de todos los registros
create table public.miembros (
  org_id      uuid not null references public.organizaciones(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rol         text not null check (rol in ('admin', 'editor', 'colaborador', 'lector')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index miembros_user_idx on public.miembros (user_id);

-- ── Proyectos (agrupan registros: una campaña, una zona, un cliente) ──────────
create table public.proyectos (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizaciones(id) on delete cascade,
  nombre      text not null,
  descripcion text not null default '',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, org_id)
);

-- ── Formularios ───────────────────────────────────────────────────────────────
-- 'schema' es el borrador que se edita en el panel. Al publicar se congela una
-- copia en formulario_versiones y la app siempre captura sobre una versión fija.
create table public.formularios (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizaciones(id) on delete cascade,
  nombre          text not null,
  descripcion     text not null default '',
  icono           text not null default '📋',
  activo          boolean not null default true,
  schema          jsonb not null default '{"claveNombre":"","claveSubtitulo":"","secciones":[]}'::jsonb,
  version_actual  integer,  -- null hasta la primera publicación
  -- Estados que puede tener un registro de este formulario (estilo Fulcrum)
  estados         jsonb not null default
    '[{"valor":"borrador","etiqueta":"Borrador","color":"#9ca3af"},
      {"valor":"enviado","etiqueta":"Enviado","color":"#3b82f6"},
      {"valor":"revisado","etiqueta":"Revisado","color":"#f59e0b"},
      {"valor":"aprobado","etiqueta":"Aprobado","color":"#10b981"},
      {"valor":"rechazado","etiqueta":"Rechazado","color":"#ef4444"}]'::jsonb,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, org_id)
);
create index formularios_org_idx on public.formularios (org_id);

create table public.formulario_versiones (
  formulario_id  uuid not null references public.formularios(id) on delete cascade,
  version        integer not null,
  schema         jsonb not null,
  publicado_por  uuid references auth.users(id) on delete set null,
  publicado_en   timestamptz not null default now(),
  primary key (formulario_id, version)
);

-- Si un formulario no tiene asignaciones, lo ven todos los colaboradores de la org.
create table public.formulario_asignaciones (
  formulario_id  uuid not null references public.formularios(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (formulario_id, user_id)
);
create index formulario_asignaciones_user_idx on public.formulario_asignaciones (user_id);

-- ── Registros (las respuestas capturadas) ─────────────────────────────────────
-- El id lo genera el celular (uuid) para poder crear registros sin señal.
-- Los grupos repetibles (lotes, miembros del hogar) viven dentro de 'datos'
-- como arreglos de objetos.
create table public.registros (
  id                  uuid primary key,
  org_id              uuid not null,
  formulario_id       uuid not null,
  formulario_version  integer not null,
  proyecto_id         uuid,
  estado              text not null default 'borrador',
  datos               jsonb not null default '{}'::jsonb,
  geom                extensions.geometry(Geometry, 4326),  -- punto, línea o polígono
  asignado_a          uuid references auth.users(id) on delete set null,
  creado_por          uuid not null references auth.users(id),
  actualizado_por     uuid references auth.users(id),
  creado_en           timestamptz not null,        -- hora del celular
  actualizado_en      timestamptz not null,        -- hora del celular
  recibido_en         timestamptz not null default now(),  -- hora del servidor
  revision            integer not null default 1,  -- sube en cada cambio (control de conflictos)
  eliminado           boolean not null default false,
  foreign key (formulario_id, org_id) references public.formularios (id, org_id),
  foreign key (formulario_id, formulario_version)
    references public.formulario_versiones (formulario_id, version),
  foreign key (proyecto_id, org_id) references public.proyectos (id, org_id)
);
create index registros_org_form_idx on public.registros (org_id, formulario_id);
create index registros_creado_por_idx on public.registros (creado_por);
create index registros_asignado_idx on public.registros (asignado_a);
create index registros_recibido_idx on public.registros (recibido_en);
create index registros_geom_idx on public.registros using gist (geom);

-- Historial: copia de cada versión anterior de un registro (quién y cuándo)
create table public.registros_historial (
  id            bigint generated always as identity primary key,
  registro_id   uuid not null references public.registros(id) on delete cascade,
  org_id        uuid not null,
  revision      integer not null,
  estado        text not null,
  datos         jsonb not null,
  geom          extensions.geometry(Geometry, 4326),
  cambiado_por  uuid,
  cambiado_en   timestamptz not null default now()
);
create index registros_historial_registro_idx on public.registros_historial (registro_id);

-- ── Archivos (fotos, firmas, audio) ───────────────────────────────────────────
-- El archivo vive en Storage (bucket privado 'campo-archivos'); aquí va su ficha.
-- Ruta en Storage: {org_id}/{registro_id}/{id}.{ext}
create table public.archivos (
  id            uuid primary key,
  org_id        uuid not null references public.organizaciones(id) on delete cascade,
  registro_id   uuid not null references public.registros(id) on delete cascade,
  campo_key     text not null,
  tipo          text not null check (tipo in ('foto', 'firma', 'audio', 'video', 'documento')),
  storage_path  text not null unique,
  mime          text not null default '',
  bytes         integer,
  latitud       double precision,
  longitud      double precision,
  creado_por    uuid not null references auth.users(id),
  creado_en     timestamptz not null default now()
);
create index archivos_registro_idx on public.archivos (registro_id);
