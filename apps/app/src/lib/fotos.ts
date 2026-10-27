// Fotos y firmas: se guardan como archivos en el celular y se suben al sincronizar.
// Cada foto guarda su origen: las de cámara con GPS y hora del momento; las de
// galería con la fecha y el GPS originales del archivo (EXIF), para revisarlas en el panel.

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { db, type ArchivoLocal } from './db.ts';
import { tomarPunto } from './gps.ts';

function base64ABlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Grados desde EXIF: acepta número, "3.1968" o "3/1,11/1,4876/100" */
function gradosExif(v: unknown, ref: unknown): number | null {
  if (v == null) return null;
  let g: number;
  if (typeof v === 'number') g = v;
  else {
    const partes = String(v).split(',').map((p) => {
      const [a, b] = p.trim().split('/').map(Number);
      return b ? a / b : a;
    });
    if (partes.some((n) => Number.isNaN(n))) return null;
    g = (partes[0] ?? 0) + (partes[1] ?? 0) / 60 + (partes[2] ?? 0) / 3600;
  }
  return /^[SW]/i.test(String(ref ?? '')) ? -Math.abs(g) : g;
}

/** "2026:10:27 14:03:22" → ISO (hora local del celular que tomó la foto) */
function fechaExif(v: unknown): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).toISOString() : null;
}

const CLAVES_EXIF = ['DateTimeOriginal', 'DateTime', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'Make', 'Model'];

export async function tomarFoto(opciones: {
  desdeGaleria: boolean; registroId: string; orgId: string; campoKey: string;
}): Promise<ArchivoLocal | null> {
  let foto;
  try {
    foto = await Camera.getPhoto({
      source: opciones.desdeGaleria ? CameraSource.Photos : CameraSource.Camera,
      resultType: CameraResultType.Base64,
      quality: 60,           // comprimidas: cada foto queda en unos cientos de KB
      width: 1600,
      correctOrientation: true,
      saveToGallery: false,
      webUseInput: true,
    });
  } catch {
    return null;  // el colaborador canceló
  }
  if (!foto.base64String) return null;

  const mime = `image/${foto.format === 'png' ? 'png' : foto.format === 'webp' ? 'webp' : 'jpeg'}`;
  const exifCrudo = (foto.exif ?? {}) as Record<string, unknown>;
  const exif = Object.fromEntries(CLAVES_EXIF.filter((k) => exifCrudo[k] != null).map((k) => [k, exifCrudo[k]]));

  let lat: number | null = null, lon: number | null = null, precision: number | null = null, tomada: string | null;
  if (opciones.desdeGaleria) {
    lat = gradosExif(exif.GPSLatitude, exif.GPSLatitudeRef);
    lon = gradosExif(exif.GPSLongitude, exif.GPSLongitudeRef);
    tomada = fechaExif(exif.DateTimeOriginal ?? exif.DateTime);
  } else {
    const p = await tomarPunto(8000);
    if (p) { lat = p.lat; lon = p.lon; precision = p.precision; }
    tomada = new Date().toISOString();
  }

  const archivo: ArchivoLocal = {
    id: crypto.randomUUID(),
    registro_id: opciones.registroId,
    org_id: opciones.orgId,
    campo_key: opciones.campoKey,
    tipo: 'foto',
    origen: opciones.desdeGaleria ? 'galeria' : 'camara',
    datos: base64ABlob(foto.base64String, mime),
    mime, tomada_en: tomada, lat, lon, precision, exif,
    pendiente: 1,
  };
  await db.archivos.put(archivo);
  return archivo;
}

/** La firma llega como imagen PNG en base64 (data URL) */
export async function guardarFirma(opciones: {
  dataUrl: string; registroId: string; orgId: string; campoKey: string; anteriorId?: string;
}): Promise<string> {
  if (opciones.anteriorId) await borrarArchivo(opciones.anteriorId);
  const id = crypto.randomUUID();
  await db.archivos.put({
    id, registro_id: opciones.registroId, org_id: opciones.orgId, campo_key: opciones.campoKey,
    tipo: 'firma', origen: 'firma',
    datos: base64ABlob(opciones.dataUrl.split(',')[1] ?? '', 'image/png'), mime: 'image/png',
    tomada_en: new Date().toISOString(), lat: null, lon: null, precision: null, exif: {}, pendiente: 1,
  });
  return id;
}

/** Solo se borran del celular los que aún no se subieron */
export async function borrarArchivo(id: string) {
  const a = await db.archivos.get(id);
  if (a?.pendiente) await db.archivos.delete(id);
}

const urls = new Map<string, string>();
export async function urlArchivo(id: string): Promise<string | null> {
  if (urls.has(id)) return urls.get(id)!;
  const a = await db.archivos.get(id);
  if (!a) return null;
  const u = URL.createObjectURL(a.datos);
  urls.set(id, u);
  return u;
}
