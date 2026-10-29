// Encuestas de un formulario guardadas en el celular.

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, CloudUpload, Trash2 } from 'lucide-react';
import { claveTitulo } from '@geoorigen/motor';
import { db, type FormularioLocal, type RegistroLocal } from '../lib/db.ts';
import { borrarArchivo } from '../lib/fotos.ts';

const ESTADO: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: 'Borrador', clase: 'bg-gray-100 text-gray-600' },
  enviado: { texto: 'Enviada', clase: 'bg-blue-100 text-blue-700' },
  revisado: { texto: 'Revisada', clase: 'bg-amber-100 text-amber-700' },
  aprobado: { texto: 'Aprobada', clase: 'bg-emerald-100 text-emerald-700' },
  rechazado: { texto: 'Rechazada', clase: 'bg-red-100 text-red-700' },
};

export function Lista({ form, onAbrir, onNueva, onVolver }: {
  form: FormularioLocal; onAbrir: (id: string) => void; onNueva: () => void; onVolver: () => void;
}) {
  const [registros, setRegistros] = useState<RegistroLocal[]>([]);

  const cargar = async () => {
    const rs = await db.registros.where({ formulario_id: form.id }).toArray();
    setRegistros(rs.sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en)));
  };
  useEffect(() => { cargar(); }, [form.id]);

  const titulo = (r: RegistroLocal) => {
    const clave = claveTitulo(form.esquema);
    const t = clave ? r.datos[clave] : '';
    return typeof t === 'string' && t ? t : 'Sin nombre todavía';
  };
  const subtitulo = (r: RegistroLocal) => {
    const s = form.esquema.claveSubtitulo ? r.datos[form.esquema.claveSubtitulo] : '';
    return typeof s === 'string' ? s : '';
  };

  // Solo se pueden borrar los borradores que nunca se subieron
  const borrar = async (r: RegistroLocal) => {
    if (!confirm('¿Borrar este borrador? No se puede deshacer.')) return;
    const archivos = await db.archivos.where({ registro_id: r.id }).toArray();
    await Promise.all(archivos.map((a) => borrarArchivo(a.id)));
    await db.registros.delete(r.id);
    cargar();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-primary px-3 py-3 text-white">
        <button onClick={onVolver} className="rounded-lg p-1 active:bg-white/20" aria-label="Volver"><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{form.icono} {form.nombre}</h1>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4 pb-24">
        {registros.length === 0 && <p className="tarjeta text-center text-sm text-gray-500">Todavía no hay encuestas. Toca "Nueva encuesta".</p>}
        {registros.map((r) => {
          const e = ESTADO[r.estado] ?? { texto: r.estado, clase: 'bg-gray-100' };
          return (
            <div key={r.id} className="tarjeta flex items-center gap-3 p-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => onAbrir(r.id)}>
                <p className="truncate font-semibold">{titulo(r)}</p>
                {subtitulo(r) && <p className="truncate text-sm text-gray-500">{subtitulo(r)}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${e.clase}`}>{e.texto}</span>
                  {!!r.pendiente && <span className="inline-flex items-center gap-1 text-accent"><CloudUpload className="h-3 w-3" /> por subir</span>}
                  <span className="text-gray-400">{new Date(r.actualizado_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </p>
              </button>
              {r.estado === 'borrador' && !r.en_servidor && (
                <button className="rounded-lg p-2 text-gray-400 active:bg-red-50 active:text-red-600" onClick={() => borrar(r)} aria-label="Borrar borrador">
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute right-0 bottom-0 left-0 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button className="btn-primario w-full py-4 text-lg shadow-lg" onClick={onNueva}><Plus className="h-6 w-6" /> Nueva encuesta</button>
      </div>
    </div>
  );
}
