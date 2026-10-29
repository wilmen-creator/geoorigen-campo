// QR del productor: se genera en el panel con los datos de su encuesta de línea base
// y la app lo lee en las visitas (asistencia técnica) para llenar esos datos solos.
// Cada campo dice qué dato del productor es (campo.datoQR); así la línea base y la
// visita pueden tener preguntas con nombres distintos y aun así entenderse.

import { claveDatoQR, type Campo, type DatoQR, type Esquema, type Ubicacion, type Valores } from './tipos.ts';

const PREFIJO = 'GEO1:';

export interface ContenidoQR {
  /** Organización y encuesta de línea base de donde salió */
  o: string;
  r: string;
  d: Partial<Record<DatoQR, string | Ubicacion>>;
}

const camposConDato = (esquema: Esquema): Campo[] =>
  esquema.secciones.flatMap((s) => s.campos).filter((c) => c.datoQR);

/** ¿Este formulario tiene datos marcados para el QR? */
export const tieneDatosQR = (esquema: Esquema) => camposConDato(esquema).length > 0;

/** Texto del QR de una encuesta (null si el formulario no tiene datos para el QR) */
export function armarQR(esquema: Esquema, datos: Valores, orgId: string, registroId: string): string | null {
  const d: ContenidoQR['d'] = {};
  for (const c of camposConDato(esquema)) {
    const v = datos[c.key];
    if (c.datoQR === 'ubicacion') {
      if (v && typeof v === 'object' && 'lat' in v) {
        // 6 decimales ≈ 10 cm: suficiente y deja el QR pequeño
        d.ubicacion = { lat: Math.round(v.lat * 1e6) / 1e6, lon: Math.round(v.lon * 1e6) / 1e6 };
      }
    } else if (typeof v === 'string' && v.trim()) {
      d[c.datoQR!] = v.trim();
    }
  }
  if (!Object.keys(d).length) return null;
  const contenido: ContenidoQR = { o: orgId, r: registroId, d };
  return PREFIJO + JSON.stringify(contenido);
}

/** Lee el texto de un QR. Devuelve null si no es un QR de GeoOrigen. */
export function leerQR(texto: string): ContenidoQR | null {
  if (!texto.startsWith(PREFIJO)) return null;
  try {
    const c = JSON.parse(texto.slice(PREFIJO.length)) as ContenidoQR;
    if (typeof c?.o !== 'string' || typeof c?.r !== 'string' || typeof c?.d !== 'object' || !c.d) return null;
    return c;
  } catch {
    return null;
  }
}

/**
 * Llena los campos marcados con datoQR y guarda en el campo 'qr' de dónde salió.
 * Devuelve los datos nuevos y cuántos campos se llenaron.
 */
export function aplicarQR(esquema: Esquema, datos: Valores, campoQR: string, qr: ContenidoQR): { datos: Valores; llenados: number } {
  const nuevos: Valores = { ...datos, [campoQR]: qr.r };
  let llenados = 0;
  // 1. Los datos que trae el propio campo QR (bloque de solo lectura). Los que no
  //    vengan en este QR se vacían, para no mezclar productores al escanear otro.
  const campo = esquema.secciones.flatMap((s) => s.campos).find((c) => c.key === campoQR);
  for (const dato of campo?.traeQR ?? []) {
    const v = qr.d[dato];
    const clave = claveDatoQR(campoQR, dato);
    if (dato === 'ubicacion' ? v && typeof v === 'object' : typeof v === 'string') {
      nuevos[clave] = typeof v === 'object' ? { lat: v.lat, lon: v.lon } : v!;
      llenados++;
    } else {
      nuevos[clave] = null;
    }
  }
  // 2. Las preguntas marcadas con «Dato del productor (QR)» (opción avanzada, editables)
  for (const c of camposConDato(esquema)) {
    const v = qr.d[c.datoQR!];
    if (v == null) continue;
    if (c.tipo === 'gps') {
      if (typeof v === 'object' && 'lat' in v) { nuevos[c.key] = { lat: v.lat, lon: v.lon }; llenados++; }
    } else if (typeof v === 'string') {
      nuevos[c.key] = v;
      llenados++;
    }
  }
  return { datos: nuevos, llenados };
}
