// Base de datos del celular (IndexedDB). Todo se guarda aquí primero y se sube
// cuando el colaborador toca "Sincronizar".

import Dexie, { type Table } from 'dexie';
import type { Esquema, Valores } from '@geoorigen/motor';

export interface FormularioLocal {
  id: string;
  org_id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  version: number;           // versión publicada que se captura
  esquema: Esquema;
  estados: { valor: string; etiqueta: string; color: string }[];
}

export interface PuntoGPS {
  lat: number;
  lon: number;
  precision: number;         // metros
  en: string;                // hora del GPS (ISO)
}

export interface RegistroLocal {
  id: string;
  org_id: string;
  formulario_id: string;
  formulario_version: number;
  /** Quién la hizo en este celular (celular compartido: cada técnico ve y sube solo las suyas).
   *  Vacío en las encuestas de versiones anteriores de la app. */
  user_id?: string;
  estado: string;            // borrador | enviado | revisado | aprobado | rechazado
  datos: Valores;
  creado_en: string;
  actualizado_en: string;
  /** Evidencia de captura: se toma sola y no se puede editar */
  captura_inicio: PuntoGPS | null;
  captura_fin: PuntoGPS | null;
  ubicacion_simulada: boolean;
  dispositivo: Record<string, string>;
  /** Ya existe en el servidor (se actualiza en vez de crearse) */
  en_servidor: boolean;
  /** Tiene cambios locales sin subir (1/0 para poder indexarlo) */
  pendiente: 0 | 1;
  revision: number;
  sincronizado_en?: string;
}

export interface ArchivoLocal {
  id: string;
  registro_id: string;
  org_id: string;
  campo_key: string;
  tipo: 'foto' | 'firma';
  origen: 'camara' | 'galeria' | 'firma';
  datos: Blob;
  mime: string;
  tomada_en: string | null;
  lat: number | null;
  lon: number | null;
  precision: number | null;
  exif: Record<string, unknown>;
  pendiente: 0 | 1;
}

class BaseCampo extends Dexie {
  formularios!: Table<FormularioLocal, string>;
  registros!: Table<RegistroLocal, string>;
  archivos!: Table<ArchivoLocal, string>;

  constructor() {
    // Base nueva: la de la versión anterior de la app solo tenía datos de prueba
    super('geoorigen_campo_v2');
    this.version(1).stores({
      formularios: 'id, org_id',
      registros: 'id, org_id, formulario_id, pendiente, actualizado_en',
      archivos: 'id, registro_id, pendiente',
    });
  }
}

export const db = new BaseCampo();

/** Guarda cambios del colaborador: queda pendiente de subir */
export async function guardarLocal(r: RegistroLocal) {
  await db.registros.put({ ...r, actualizado_en: new Date().toISOString(), pendiente: 1 });
}

/** ¿La encuesta es de este usuario? Las de versiones anteriores (sin dueño) cuentan para quien entre. */
export const esDe = (r: RegistroLocal, userId: string | undefined) => !r.user_id || r.user_id === userId;

/** Solo se suben las encuestas completas (enviadas): un borrador a medias se queda en
 *  el celular hasta que el técnico la termine, para no subir datos incompletos o duplicados. */
export const porSubir = (r: RegistroLocal) => !!r.pendiente && r.estado !== 'borrador';
export const incompleta = (r: RegistroLocal) => !!r.pendiente && r.estado === 'borrador';

/** Ya está en el servidor y no tiene cambios: el técnico no la puede editar, salvo que
 *  un admin o editor la devuelva para corregir (estado rechazado). */
export const bloqueada = (r: RegistroLocal) => r.en_servidor && !r.pendiente && r.estado !== 'rechazado';

/** Texto sin tildes y en minúscula, para buscar */
export const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export async function contarPendientes(orgId: string, userId?: string) {
  const mios = await db.registros.where({ pendiente: 1 }).filter((r) => r.org_id === orgId && esDe(r, userId)).toArray();
  const archs = await db.archivos.where({ pendiente: 1 }).filter((a) => a.org_id === orgId).toArray();
  let archivos = 0;
  for (const a of archs) {
    const r = await db.registros.get(a.registro_id);
    if (r && esDe(r, userId) && (r.en_servidor || porSubir(r))) archivos++;
  }
  return { registros: mios.filter(porSubir).length, incompletas: mios.filter(incompleta).length, archivos };
}

/** Todo lo que hay sin subir en el celular, de cualquier usuario (para avisar antes de salir) */
export async function contarPendientesCelular() {
  return (await db.registros.where({ pendiente: 1 }).count()) + (await db.archivos.where({ pendiente: 1 }).count());
}

// Pide al sistema que no borre la base del celular aunque falte espacio
export async function pedirAlmacenamientoPersistente() {
  try { await navigator.storage?.persist?.(); } catch { /* no disponible */ }
}
