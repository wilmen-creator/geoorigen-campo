// Llenado de una encuesta, sección por sección. Se guarda sola en el celular.
// La evidencia de captura (GPS al abrir y al enviar) se toma en silencio: el
// técnico no la ve y nunca le impide guardar ni enviar.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Send, AlertCircle } from 'lucide-react';
import {
  calcularDerivados, camposVisibles, seccionesVisibles, validarRegistro,
  type ErrorValidacion, type Valores,
} from '@geoorigen/motor';
import { db, guardarLocal, type FormularioLocal, type RegistroLocal } from '../lib/db.ts';
import { datosDispositivo, tomarEvidencia } from '../lib/gps.ts';
import { CampoApp, type ContextoCampo } from './Campos.tsx';

const BLOQUEADOS = ['revisado', 'aprobado'];

/** Crea una encuesta nueva y empieza a tomar el GPS de captura en segundo plano */
export async function nuevaEncuesta(form: FormularioLocal): Promise<string> {
  const ahora = new Date().toISOString();
  const r: RegistroLocal = {
    id: crypto.randomUUID(), org_id: form.org_id, formulario_id: form.id, formulario_version: form.version,
    estado: 'borrador', datos: calcularDerivados(form.esquema, {}), creado_en: ahora, actualizado_en: ahora,
    captura_inicio: null, captura_fin: null, ubicacion_simulada: false, dispositivo: await datosDispositivo(),
    en_servidor: false, pendiente: 1, revision: 0,
  };
  await db.registros.put(r);
  tomarEvidencia().then(async ({ punto, simulada }) => {
    // Solo la evidencia: no se toca lo que el técnico haya escrito mientras tanto
    await db.registros.update(r.id, { captura_inicio: punto, ubicacion_simulada: simulada });
  });
  return r.id;
}

export function Encuesta({ registroId, onSalir }: { registroId: string; onSalir: () => void }) {
  const [registro, setRegistro] = useState<RegistroLocal | null>(null);
  const [form, setForm] = useState<FormularioLocal | null>(null);
  const [paso, setPaso] = useState(0);
  const [errores, setErrores] = useState<ErrorValidacion[]>([]);
  const [enviando, setEnviando] = useState(false);
  const cambiado = useRef(false);
  const arriba = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.registros.get(registroId).then(async (r) => {
      if (!r) return onSalir();
      setRegistro(r);
      setForm((await db.formularios.get(r.formulario_id)) ?? null);
    });
  }, [registroId, onSalir]);

  // Si el GPS de apertura falló (permiso tardío, sin señal), se reintenta en
  // silencio mientras la encuesta está abierta. Guarda la hora real del GPS.
  useEffect(() => {
    let activo = true;
    const intentar = async (n: number) => {
      const r = await db.registros.get(registroId);
      if (!activo || !r || r.captura_inicio || r.en_servidor || n > 4) return;
      const { punto, simulada } = await tomarEvidencia();
      if (punto && activo) {
        await db.registros.update(registroId, { captura_inicio: punto, ubicacion_simulada: r.ubicacion_simulada || simulada });
      } else if (activo) {
        setTimeout(() => intentar(n + 1), 30000);
      }
    };
    const t = setTimeout(() => intentar(1), 25000);  // después del primer intento de nuevaEncuesta
    return () => { activo = false; clearTimeout(t); };
  }, [registroId]);

  const soloLectura = registro ? BLOQUEADOS.includes(registro.estado) : true;

  // Autoguardado: medio segundo después del último cambio
  useEffect(() => {
    if (!registro || !cambiado.current) return;
    const t = setTimeout(async () => {
      // La evidencia pudo llegar mientras se escribía: se conserva la de la base
      const enBase = await db.registros.get(registro.id);
      await guardarLocal({ ...registro, captura_inicio: enBase?.captura_inicio ?? null, ubicacion_simulada: enBase?.ubicacion_simulada ?? false });
    }, 500);
    return () => clearTimeout(t);
  }, [registro]);

  const esquema = form?.esquema;
  const secciones = useMemo(() => (esquema && registro ? seccionesVisibles(esquema, registro.datos) : []), [esquema, registro]);
  const seccion = secciones[Math.min(paso, Math.max(0, secciones.length - 1))];
  const rutasError = useMemo(() => new Set(errores.map((e) => e.ruta)), [errores]);

  if (!registro) return null;
  if (!form || !esquema) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-gray-600">Este formulario ya no está disponible en el celular. Sincroniza para actualizarlo.</p>
        <button className="btn-secundario" onClick={onSalir}>Volver</button>
      </div>
    );
  }

  const ctx: ContextoCampo = { registroId: registro.id, orgId: registro.org_id, soloLectura, errores: rutasError };

  const cambiar = (key: string, v: Valores[string]) => {
    cambiado.current = true;
    setRegistro((r) => (r ? {
      ...r,
      datos: calcularDerivados(esquema, { ...r.datos, [key]: v }),
      // Al corregir una encuesta rechazada vuelve a quedar como borrador hasta enviarla
      estado: r.estado === 'rechazado' ? 'borrador' : r.estado,
    } : r));
    if (errores.length) setErrores((e) => e.filter((x) => !x.ruta.startsWith(key)));
  };

  const ir = (n: number) => {
    setPaso(n);
    arriba.current?.scrollTo({ top: 0 });
  };

  const enviar = async () => {
    const encontrados = validarRegistro(esquema, registro.datos);
    setErrores(encontrados);
    if (encontrados.length) {
      const primera = secciones.findIndex((s) => s.id === encontrados[0].seccionId);
      if (primera >= 0) ir(primera);
      return;
    }
    setEnviando(true);
    const { punto, simulada } = await tomarEvidencia();
    const enBase = await db.registros.get(registro.id);
    await guardarLocal({
      ...registro,
      estado: 'enviado',
      captura_inicio: enBase?.captura_inicio ?? null,
      // El punto de fin se toma una sola vez (al primer envío)
      captura_fin: enBase?.captura_fin ?? punto,
      ubicacion_simulada: (enBase?.ubicacion_simulada ?? false) || simulada,
    });
    setEnviando(false);
    onSalir();
  };

  const titulo = (esquema.claveNombre && typeof registro.datos[esquema.claveNombre] === 'string' && registro.datos[esquema.claveNombre]) || form.nombre;
  const ultimo = paso >= secciones.length - 1;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-primary px-3 py-3 text-white">
        <button onClick={onSalir} className="rounded-lg p-1 active:bg-white/20" aria-label="Guardar y volver"><ArrowLeft className="h-6 w-6" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{String(titulo)}</p>
          <p className="text-xs opacity-80">{form.icono} {form.nombre} · {paso + 1} de {secciones.length}</p>
        </div>
      </header>

      {/* Avance por secciones */}
      <div className="flex gap-1 bg-white px-3 py-2">
        {secciones.map((s, i) => {
          const conError = errores.some((e) => e.seccionId === s.id);
          return (
            <button key={s.id} onClick={() => ir(i)} aria-label={s.titulo}
              className={`h-1.5 flex-1 rounded-full ${conError ? 'bg-red-400' : i <= paso ? 'bg-primary' : 'bg-gray-200'}`} />
          );
        })}
      </div>

      <div ref={arriba} className="flex-1 overflow-y-auto">
        {soloLectura && (
          <p className="mx-4 mt-4 rounded-xl bg-primary-light px-3 py-2 text-sm text-primary">
            Esta encuesta ya fue {registro.estado === 'aprobado' ? 'aprobada' : 'revisada'}: solo se puede consultar.
          </p>
        )}
        {registro.estado === 'rechazado' && (
          <p className="mx-4 mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            Fue rechazada en la revisión. Corrígela y vuelve a enviarla.
          </p>
        )}
        {errores.length > 0 && (
          <div className="mx-4 mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <p className="flex items-center gap-1 font-semibold"><AlertCircle className="h-4 w-4" /> Falta completar {errores.length} dato(s)</p>
            <ul className="mt-1 list-disc pl-5">
              {errores.slice(0, 6).map((e, i) => <li key={i}>{e.mensaje}</li>)}
            </ul>
          </div>
        )}

        {seccion && (
          <div className="space-y-5 p-4 pb-8">
            <div>
              <h2 className="text-lg font-bold">{seccion.titulo}</h2>
              {seccion.descripcion && <p className="text-sm text-gray-500">{seccion.descripcion}</p>}
            </div>
            {camposVisibles(seccion.campos, [registro.datos]).map((c) => (
              <CampoApp key={c.key} campo={c} ctx={ctx} contexto={[registro.datos]} ruta={c.key} onChange={(v) => cambiar(c.key, v)} />
            ))}
          </div>
        )}
      </div>

      <footer className="flex gap-2 border-t border-gray-200 bg-white p-3">
        <button className="btn-secundario" disabled={paso === 0} onClick={() => ir(paso - 1)}><ChevronLeft className="h-5 w-5" /></button>
        {ultimo ? (
          !soloLectura && (
            <button className="btn-primario flex-1" onClick={enviar} disabled={enviando}>
              <Send className="h-5 w-5" /> {enviando ? 'Guardando…' : registro.estado === 'enviado' ? 'Guardar cambios' : 'Enviar encuesta'}
            </button>
          )
        ) : (
          <button className="btn-primario flex-1" onClick={() => ir(paso + 1)}>Siguiente <ChevronRight className="h-5 w-5" /></button>
        )}
      </footer>
    </div>
  );
}
