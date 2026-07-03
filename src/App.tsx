import { useEffect, useState } from 'react';
import './theme.css';
import './app.css';
import type { Encuesta } from './types';
import { encuestaVacia } from './types';
import type { RegistroGenerico } from './generico/tipos';
import { registroVacio } from './generico/tipos';
import { esquemaCacao } from './generico/schema-cacao';
import {
  listarEncuestas, borrarEncuesta, listarRegistros, borrarRegistro,
} from './db';
import { sincronizar, sincronizarGenerico } from './sync';
import { Inicio } from './components/Inicio';
import { ListaEncuestas } from './components/ListaEncuestas';
import { ListaGenerica } from './components/ListaGenerica';
import { Wizard } from './components/Wizard';
import { WizardGenerico } from './components/WizardGenerico';
import { Ajustes } from './components/Ajustes';

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'cafe-lista' }
  | { tipo: 'cafe-wizard'; encuesta: Encuesta }
  | { tipo: 'cacao-lista' }
  | { tipo: 'cacao-wizard'; registro: RegistroGenerico }
  | { tipo: 'ajustes' };

export default function App() {
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [registrosCacao, setRegistrosCacao] = useState<RegistroGenerico[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensajeSync, setMensajeSync] = useState('');
  const [enLinea, setEnLinea] = useState(navigator.onLine);

  const recargarCafe = async () => setEncuestas(await listarEncuestas());
  const recargarCacao = async () => setRegistrosCacao(await listarRegistros('cacao'));
  const recargarTodo = async () => { await recargarCafe(); await recargarCacao(); };

  useEffect(() => {
    recargarTodo();
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
  const syncCafe = async () => {
    setSincronizando(true);
    setMensajeSync('');
    const r = await sincronizar();
    setMensajeSync(r.mensaje);
    setSincronizando(false);
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
  const syncCacao = async () => {
    setSincronizando(true);
    setMensajeSync('');
    const r = await sincronizarGenerico('cacao');
    setMensajeSync(r.mensaje);
    setSincronizando(false);
    recargarCacao();
  };

  const volverAInicio = () => setVista({ tipo: 'inicio' });

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
        onSincronizar={syncCafe}
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
        onSincronizar={syncCacao}
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
    />
  );
}
