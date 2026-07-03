import Dexie, { type Table } from 'dexie';
import type { Encuesta } from './types';
import type { RegistroGenerico } from './generico/tipos';

class GeoOrigenDB extends Dexie {
  encuestas!: Table<Encuesta, string>;
  registros!: Table<RegistroGenerico, string>;

  constructor() {
    super('geoorigen_campo_db');
    this.version(1).stores({
      // 'id' como clave primaria, índices para listar/filtrar rápido
      encuestas: 'id, dni, nombre, finca, sincronizado, actualizado_en',
    });
    this.version(2).stores({
      encuestas: 'id, dni, nombre, finca, sincronizado, actualizado_en',
      // registros genéricos: cacao y futuros cultivos, por esquema
      registros: 'id, tipo, sincronizado, actualizado_en',
    });
  }
}

export const db = new GeoOrigenDB();

export async function guardarEncuesta(encuesta: Encuesta) {
  encuesta.actualizado_en = new Date().toISOString();
  await db.encuestas.put(encuesta);
}

export async function listarEncuestas() {
  return db.encuestas.orderBy('actualizado_en').reverse().toArray();
}

export async function borrarEncuesta(id: string) {
  await db.encuestas.delete(id);
}

export async function obtenerPendientes() {
  return db.encuestas.filter((e) => !e.sincronizado).toArray();
}

// ---------- Registros genéricos (cacao y futuros esquemas) ----------

export async function guardarRegistro(registro: RegistroGenerico) {
  registro.actualizado_en = new Date().toISOString();
  await db.registros.put(registro);
}

export async function listarRegistros(tipo: string) {
  const todos = await db.registros.where('tipo').equals(tipo).toArray();
  return todos.sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en));
}

export async function borrarRegistro(id: string) {
  await db.registros.delete(id);
}

export async function obtenerPendientesGenericos(tipo: string) {
  return db.registros.where('tipo').equals(tipo).filter((r) => !r.sincronizado).toArray();
}
