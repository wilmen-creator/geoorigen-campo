import Dexie, { type Table } from 'dexie';
import type { Encuesta } from './types';
import type { RegistroGenerico, FormularioDinamico } from './generico/tipos';

class GeoOrigenDB extends Dexie {
  encuestas!: Table<Encuesta, string>;
  registros!: Table<RegistroGenerico, string>;
  formularios!: Table<FormularioDinamico, string>;

  constructor() {
    super('geoorigen_campo_db');
    this.version(1).stores({
      encuestas: 'id, dni, nombre, finca, sincronizado, actualizado_en',
    });
    this.version(2).stores({
      encuestas: 'id, dni, nombre, finca, sincronizado, actualizado_en',
      registros: 'id, tipo, sincronizado, actualizado_en',
    });
    this.version(3).stores({
      encuestas: 'id, dni, nombre, finca, sincronizado, actualizado_en',
      registros: 'id, tipo, sincronizado, actualizado_en',
      // Schemas de formularios descargados desde Supabase
      formularios: 'id, nombre, activo, version, updated_at',
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

// ---------- Formularios dinámicos (schemas descargados de Supabase) ----------

export async function guardarFormulario(form: FormularioDinamico) {
  await db.formularios.put(form);
}

export async function listarFormularios() {
  const todos = await db.formularios.where('activo').equals(1).toArray();
  return todos.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function obtenerFormulario(id: string) {
  return db.formularios.get(id);
}
