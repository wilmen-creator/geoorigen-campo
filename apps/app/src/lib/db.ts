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

export async function contarPendientes(orgId: string) {
  const [regs, archs] = await Promise.all([
    db.registros.where({ pendiente: 1 }).filter((r) => r.org_id === orgId).count(),
    db.archivos.where({ pendiente: 1 }).filter((a) => a.org_id === orgId).count(),
  ]);
  return { registros: regs, archivos: archs };
}
