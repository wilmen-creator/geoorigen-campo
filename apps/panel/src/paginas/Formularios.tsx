import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Pencil, Power, Trash2 } from 'lucide-react';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { puedeEditar, useSesion } from '../lib/sesion.tsx';
import { esquemaVacio } from '../editor/catalogo.ts';

interface FilaFormulario {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  activo: boolean;
  version_actual: number | null;
  updated_at: string;
  formulario_versiones: { version: number; publicado_en: string }[];
}

function estadoPublicacion(f: FilaFormulario) {
  if (!f.version_actual) return { texto: 'Sin publicar', clase: 'bg-amber-50 text-amber-700' };
  const actual = f.formulario_versiones.find((v) => v.version === f.version_actual);
  const cambios = actual && new Date(f.updated_at).getTime() > new Date(actual.publicado_en).getTime() + 1000;
  return cambios
    ? { texto: `v${f.version_actual} · cambios sin publicar`, clase: 'bg-amber-50 text-amber-700' }
    : { texto: `v${f.version_actual} publicada`, clase: 'bg-primary-light text-primary' };
}

export function Formularios() {
  const { org } = useSesion();
  const navigate = useNavigate();
  const [lista, setLista] = useState<FilaFormulario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const editar = puedeEditar(org?.rol);

  const cargar = useCallback(async () => {
    if (!org) return;
    const { data, error: err } = await supabase
      .from('formularios')
      .select('id, nombre, descripcion, icono, activo, version_actual, updated_at, formulario_versiones(version, publicado_en)')
      .eq('org_id', org.org_id)
      .order('nombre');
    if (err) setError(mensajeError(err));
    setLista((data ?? []) as FilaFormulario[]);
    setCargando(false);
  }, [org]);

  useEffect(() => { cargar(); }, [cargar]);

  const crear = async () => {
    if (!org) return;
    const { data, error: err } = await supabase
      .from('formularios')
      .insert({ org_id: org.org_id, nombre: 'Nuevo formulario', schema: esquemaVacio() })
      .select('id')
      .single();
    if (err) return setError(mensajeError(err));
    navigate(`/formularios/${data.id}`);
  };

  const alternarActivo = async (f: FilaFormulario) => {
    const { error: err } = await supabase.from('formularios').update({ activo: !f.activo }).eq('id', f.id);
    if (err) return setError(mensajeError(err));
    cargar();
  };

  const borrar = async (f: FilaFormulario) => {
    if (!confirm(`¿Borrar "${f.nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error: err } = await supabase.from('formularios').delete().eq('id', f.id);
    if (err) return setError(mensajeError(err));
    cargar();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Formularios</h1>
            <p className="text-sm text-gray-500">Diseña las encuestas y publícalas para que lleguen a la app.</p>
          </div>
          {editar && (
            <button className="btn-primary" onClick={crear}>
              <Plus className="h-4 w-4" /> Nuevo formulario
            </button>
          )}
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {cargando ? (
          <p className="text-sm text-gray-400">Cargando…</p>
        ) : lista.length === 0 ? (
          <div className="card py-12 text-center text-gray-400">
            <p className="text-3xl">📋</p>
            <p className="mt-2 text-sm">Todavía no hay formularios.</p>
          </div>
        ) : (
          <div className="card divide-y divide-gray-100 p-0">
            {lista.map((f) => {
              const estado = estadoPublicacion(f);
              return (
                <div key={f.id} className={`flex items-center gap-3 px-4 py-3 ${f.activo ? '' : 'opacity-50'}`}>
                  <span className="text-2xl">{f.icono || '📋'}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`/formularios/${f.id}`)}>
                    <span className="block truncate font-medium">{f.nombre}</span>
                    <span className="block truncate text-xs text-gray-400">{f.descripcion || 'Sin descripción'}</span>
                  </button>
                  <span className={`badge ${estado.clase}`}>{estado.texto}</span>
                  {!f.activo && <span className="badge bg-gray-100 text-gray-500">Inactivo</span>}
                  {editar && (
                    <div className="flex items-center gap-1">
                      <button className="btn-icon" title="Editar" onClick={() => navigate(`/formularios/${f.id}`)}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="btn-icon" title={f.activo ? 'Desactivar' : 'Activar'} onClick={() => alternarActivo(f)}>
                        <Power className="h-4 w-4" />
                      </button>
                      {org?.rol === 'admin' && (
                        <button className="btn-icon hover:text-red-600" title="Borrar" onClick={() => borrar(f)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
