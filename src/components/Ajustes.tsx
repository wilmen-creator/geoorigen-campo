import { useEffect, useState } from 'react';
import { obtenerConfigSupabase, guardarConfigSupabase, getSupabase } from '../supabase';

export function Ajustes({ onVolver }: { onVolver: () => void }) {
  const [url, setUrl] = useState('');
  const [anon, setAnon] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sesion, setSesion] = useState('');

  useEffect(() => {
    obtenerConfigSupabase().then((c) => { setUrl(c.url); setAnon(c.anon); });
  }, []);

  const guardar = async () => {
    await guardarConfigSupabase(url, anon);
    setMensaje('Configuración guardada.');
  };

  const iniciarSesion = async () => {
    setMensaje('Conectando...');
    const supabase = await getSupabase();
    if (!supabase) { setMensaje('Primero guarda la URL y la llave.'); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    if (error) { setMensaje(`Error: ${error.message}`); return; }
    setSesion(data.user?.email || '');
    setMensaje('Sesión iniciada correctamente.');
  };

  return (
    <div className="ajustes-contenedor">
      <header className="app-header">
        <button className="btn-texto" onClick={onVolver}>← Volver</button>
        <h1>Ajustes</h1>
      </header>

      <section className="ajustes-bloque">
        <h2>Conexión a Supabase</h2>
        <p className="ayuda">Estos datos los encuentras en tu proyecto de Supabase &gt; Project Settings &gt; API.</p>
        <label className="campo">
          <span className="campo-etiqueta">URL del proyecto</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Llave anónima (anon key)</span>
          <input value={anon} onChange={(e) => setAnon(e.target.value)} placeholder="eyJhbGciOi..." />
        </label>
        <button className="btn-primario" onClick={guardar}>Guardar configuración</button>
      </section>

      <section className="ajustes-bloque">
        <h2>Inicio de sesión del colaborador</h2>
        <p className="ayuda">Cada colaborador inicia sesión con el usuario que le creaste en Supabase Auth.</p>
        <label className="campo">
          <span className="campo-etiqueta">Correo</span>
          <input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email" />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Contraseña</span>
          <input value={clave} onChange={(e) => setClave(e.target.value)} type="password" />
        </label>
        <button className="btn-primario" onClick={iniciarSesion}>Iniciar sesión</button>
        {sesion && <p className="ayuda">Conectado como: {sesion}</p>}
      </section>

      {mensaje && <p className="mensaje-sync">{mensaje}</p>}
    </div>
  );
}
