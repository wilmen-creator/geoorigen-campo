-- =============================================================================
-- GeoOrigen Campo — 03 · Storage privado para fotos, firmas y audio
-- Ruta de cada archivo: {org_id}/{registro_id}/{archivo_id}.{ext}
-- Nada es público: el panel y la app piden enlaces firmados de corta duración.
-- Orden al sincronizar: 1) subir el registro  2) subir el archivo  3) su ficha en public.archivos
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campo-archivos', 'campo-archivos', false,
  10485760,  -- 10 MB por archivo (las fotos se comprimen en el celular)
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/webm',
        'video/mp4', 'application/pdf']
)
on conflict (id) do nothing;

-- Ver: si el registro de la carpeta es visible para el usuario (aplica las reglas de registros)
create policy campo_archivos_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'campo-archivos'
    and exists (
      select 1 from public.registros r
      where r.org_id::text = (storage.foldername(name))[1]
        and r.id::text     = (storage.foldername(name))[2]
    )
  );

-- Subir: solo dentro de la carpeta de un registro visible
create policy campo_archivos_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'campo-archivos'
    and exists (
      select 1 from public.registros r
      where r.org_id::text = (storage.foldername(name))[1]
        and r.id::text     = (storage.foldername(name))[2]
    )
  );

-- Borrar: quien lo subió, o admin/editor de la organización
create policy campo_archivos_borrar on storage.objects for delete to authenticated
  using (
    bucket_id = 'campo-archivos'
    and (
      owner_id = auth.uid()::text
      or app.rol_en(((storage.foldername(name))[1])::uuid) in ('admin', 'editor')
    )
  );
