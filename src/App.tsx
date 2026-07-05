import { useEffect, useState } from 'react';
import './theme.css';
import './app.css';
import type { Encuesta } from './types';
import { encuestaVacia } from './types';
import type { RegistroGenerico, FormularioDinamico } from './generico/tipos';
import { registroVacio } from './generico/tipos';
import { esquemaCacao } from './generico/schema-cacao';
import {
  listarEncuestas, borrarEncuesta, listarRegistros, borrarRegistro,
  listarFormularios,
} from './db';
import { sincronizar, sincronizarGenerico, sincronizarFormularios } from './sync';
import { Inicio } from './components/Inicio';
import { ListaEncuestas } from './components/ListaEncuestas';
import { ListaGenerica } from './components/ListaGenerica';
import { Wizard } from './components/Wizard';
import { WizardGenerico } from './components/WizardGenerico';
import { WizardDinamico } from './components/WizardDinamico';
import { Ajustes } from './components/Ajustes';

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'cafe-lista' }
  | { tipo: 'cafe-wizard'; encuesta: Encuesta }
  | { tipo: 'cacao-lista' }
  | { tipo: 'cacao-wizard'; registro: RegistroGenerico }
  | { tipo: 'form-lista'; formulario: FormularioDinamico }
  | { tipo: 'form-wizard'; formulario: FormularioDinamico; registro: RegistroGenerico }
  | { tipo: 'ajustes' };

export interface LineaSync {
  icono: string;
  nombre: string;
  subidas: number;
  ok: boolean;
  mensaje: string;
}

export default function App() {
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [registrosCacao, setRegistrosCacao] = useState<RegistroGenerico[]>([]);
  const [formularios, setFormularios] = useState<FormularioDinamico[]>([]);
  const [registrosDinamicos, setRegistrosDinamicos] = useState<RegistroGenerico[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');
  const [syncLineas, setSyncLineas] = useState<LineaSync[]>([]);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [sesionEmail, setSesionEmail] = useState<string | null>(null);

  const recargarCafe = async () => setEncuestas(await listarEncuestas());
  const recargarCacao = async () => setRegistrosCacao(await listarRegistros('cacao'));
  const recargarFormularios = async () => setFormularios(await listarFormularios());
  const recargarRegistrosDinamicos = async (tipo: string) =>
    setRegistrosDinamicos(await listarRegistros(tipo));
  const recargarTodo = async () => {
    await recargarCafe();
    await recargarCacao();
    await recargarFormularios();
  };

  useEffect(() => {
    recargarTodo();
    // Detectar sesión activa
    import('./supabase').then(({ getSupabase }) => {
      getSupabase().then((sb) => {
        if (!sb) return;
        sb.auth.getSession().then(({ data }) => setSesionEmail(data.session?.user.email ?? null));
        sb.auth.onAuthStateChange((_, s) => setSesionEmail(s?.user.email ?? null));
      });
    });
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (vista.tipo === 'cafe-lista') recargarCafe();
    if (vista.tipo === 'cacao-lista') recargarCacao();
    if (vista.tipo === 'form-lista') recargarRegistrosDinamicos(vista.formulario.id);
    if (vista.tipo === 'inicio') recargarTodo();
    setMensajeSync('');
  }, [vista]);

  // ---------- Café ----------
  const abrirNuevaCafe = () => setVista({ tipo: 'cafe-wizard', encuesta: encuestaVacia() });
  const abrirExistenteCafe = (e: Encuesta) => setVista({ tipo: 'cafe-wizard', encuesta: e });
  const eliminarCafe = async (id: string) => {
    if (!confirm('¿Borrar esta encuesta? Esta acción no se puede deshacer.')) return;
    await borrarEncuesta(id);
    recargarCafe();
  };

  // ---------- Cacao ----------
  const abrirNuevaCacao = () => setVista({ tipo: 'cacao-wizard', registro: registroVacio('cacao') });
  const abrirExistenteCacao = (r: RegistroGenerico) => setVista({ tipo: 'cacao-wizard', registro: r });
  const eliminarCacao = async (id: string) => {
    if (!confirm('¿Borrar este registro? Esta acción no se puede deshacer.')) return;
    await borrarRegistro(id);
    recargarCacao();
  };

  const volverAInicio = () => setVista({ tipo: 'inicio' });

  // ---------- Sincronización total ----------
  const sincronizarTodo = async () => {
    if (sincronizando) return;
    setSincronizando(true);
    setSyncLineas([]);
    setMensajeSync('');
    const lineas: LineaSync[] = [];

    // 1. Subir encuestas café pendientes
    const rCafe = await sincronizar();
    lineas.push({ icono: '☕', nombre: 'Línea Base Café', subidas: rCafe.subidas, ok: rCafe.ok, mensaje: rCafe.mensaje });

    // 2. Subir registros cacao pendientes
    const rCacao = await sincronizarGenerico('cacao');
    lineas.push({ icono: esquemaCacao.icono, nombre: esquemaCacao.nombre, subidas: rCacao.subidas, ok: rCacao.ok, mensaje: rCacao.mensaje });

    // 3. Subir respuestas de formularios dinámicos pendientes
    const formsActuales = await import('./db').then(m => m.listarFormularios());
    for (const form of formsActuales) {
      const rForm = await sincronizarGenerico(form.id);
      if (rForm.subidas > 0 || rForm.errores > 0) {
        lineas.push({ icono: form.icono, nombre: form.nombre, subidas: rForm.subidas, ok: rForm.ok, mensaje: rForm.mensaje });
      }
    }

    // 4. Descargar formularios actualizados desde Supabase
    const rForms = await sincronizarFormularios();
    lineas.push({ icono: '📥', nombre: 'Formularios', subidas: rForms.subidas, ok: rForms.ok, mensaje: rForms.mensaje });

    await recargarTodo();
    setSincronizando(false);
    setSyncLineas(lineas);
  };

  if (vista.tipo === 'form-wizard') {
    return (
      <WizardDinamico
        formulario={vista.formulario}
        inicial={vista.registro}
        onSalir={() => setVista({ tipo: 'form-lista', formulario: vista.formulario })}
      />
    );
  }

  if (vista.tipo === 'form-lista') {
    const form = vista.formulario;
    return (
      <ListaGenerica
        esquema={{
          tipo: form.id,
          nombre: form.nombre,
          icono: form.icono,
          claveNombre: form.schema.claveNombre,
          claveSubtitulo: form.schema.claveSubtitulo ?? '',
          secciones: form.schema.secciones.map((s) => ({
            titulo: s.titulo,
            campos: [],
            conGPS: s.conGPS,
          })),
        }}
        registros={registrosDinamicos}
        onAbrir={(r) => setVista({ tipo: 'form-wizard', formulario: form, registro: r })}
        onNueva={() => setVista({ tipo: 'form-wizard', formulario: form, registro: registroVacio(form.id) })}
        onBorrar={async (id) => {
          if (!confirm('¿Borrar este registro?')) return;
          await borrarRegistro(id);
          recargarRegistrosDinamicos(form.id);
        }}
        onVolver={volverAInicio}
        onSincronizar={sincronizarTodo}
        sincronizando={sincronizando}
        mensajeSync={mensajeSync}
        enLinea={enLinea}
      />
    );
  }

  if (vista.tipo === 'cafe-wizard') {
    return <Wizard inicial={vista.encuesta} onSalir={() => setVista({ tipo: 'cafe-lista' })} />;
  }

  if (vista.tipo === 'cacao-wizard') {
    return (
      <WizardGenerico
        esquema={esquemaCacao}
        inicial={vista.registro}
        onSalir={() => setVista({ tipo: 'cacao-lista' })}
      />
    );
  }

  if (vista.tipo === 'ajustes') {
    return <Ajustes onVolver={volverAInicio} />;
  }

  if (vista.tipo === 'cafe-lista') {
    return (
      <ListaEncuestas
        encuestas={encuestas}
        onAbrir={abrirExistenteCafe}
        onNueva={abrirNuevaCafe}
        onBorrar={eliminarCafe}
        onSincronizar={sincronizarTodo}
        onAjustes={() => setVista({ tipo: 'ajustes' })}
        onVolver={volverAInicio}
        sincronizando={sincronizando}
        mensajeSync={mensajeSync}
        enLinea={enLinea}
      />
    );
  }

  if (vista.tipo === 'cacao-lista') {
    return (
      <ListaGenerica
        esquema={esquemaCacao}
        registros={registrosCacao}
        onAbrir={abrirExistenteCacao}
        onNueva={abrirNuevaCacao}
        onBorrar={eliminarCacao}
        onVolver={volverAInicio}
        onSincronizar={sincronizarTodo}
        sincronizando={sincronizando}
        mensajeSync={mensajeSync}
        enLinea={enLinea}
      />
    );
  }

  return (
    <Inicio
      onCafe={() => setVista({ tipo: 'cafe-lista' })}
      onCacao={() => setVista({ tipo: 'cacao-lista' })}
      onAjustes={() => setVista({ tipo: 'ajustes' })}
      conteoCafe={encuestas.length}
      conteoCacao={registrosCacao.length}
      formularios={formularios}
      onFormulario={(f) => setVista({ tipo: 'form-lista', formulario: f })}
      onSincronizar={sincronizarTodo}
      sincronizando={sincronizando}
      syncLineas={syncLineas}
      enLinea={enLinea}
      sesionEmail={sesionEmail}
      onAjustes={() => setVista({ tipo: 'ajustes' })}
    />
  );
}
