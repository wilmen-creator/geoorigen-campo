import { useEffect, useState } from 'react';
import { getSupabase, getConfig, guardarConfig, configEnBuild } from '../supabase';

export function Ajustes({ onVolver }: { onVolver: () => void }) {
  const [url,     setUrl]     = useState('');
  const [anon,    setAnon]    = useState('');
  const [correo,  setCorreo]  = useState('');
  const [clave,   setClave]   = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sesion,  setSesion]  = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      // Cargar config guardada (para mostrar en caso de no tener build vars)
      if (!configEnBuild) {
        const cfg = await getConfig();
        setUrl(cfg.url);
        setAnon(cfg.anon);
      }
      // Detectar sesión activa
      const sb = await getSupabase();
      if (sb) {
        const { data } = await sb.auth.getSession();
        setSesion(data.session?.user.email || '');
      }
      setCargando(false);
    })();
  }, []);

  const guardarConexion = async () => {
    await guardarConfig(url, anon);
    setMensaje('Configuración guardada. Ahora inicia sesión.');
  };

  const iniciarSesion = async () => {
    setMensaje('Conectando...');
    const sb = await getSupabase();
    if (!sb) {
      setMensaje('Primero guarda la URL y la llave anónima.');
      return;
    }
    const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
    if (error) { setMensaje(`Error: ${error.message}`); return; }
    setSesion(data.user?.email || '');
    setClave('');
    setMensaje('Sesión iniciada correctamente.');
  };

  const cerrarSesion = async () => {
    const sb = await getSupabase();
    if (sb) await sb.auth.signOut();
    setSesion('');
    setMensaje('Sesión cerrada.');
  };

  if (cargando) return (
    <div className="ajustes-contenedor">
      <header className="app-header">
        <button className="btn-texto" onClick={onVolver}>← Volver</button>
        <h1>Ajustes</h1>
      </header>
      <p className="ayuda" style={{ textAlign: 'center', marginTop: '32px' }}>Cargando...</p>
    </div>
  );

  return (
    <div className="ajustes-contenedor">
      <header className="app-header">
        <button className="btn-texto" onClick={onVolver}>← Volver</button>
        <h1>Ajustes</h1>
      </header>

      {/* Conexión manual — solo visible si NO vienen las vars del build */}
      {!configEnBuild && (
        <section className="ajustes-bloque">
          <h2>Conexión a Supabase</h2>
          <p className="ayuda">Solo necesitas esto una vez. Pide los datos al administrador.</p>
          <label className="campo">
            <span className="campo-etiqueta">URL del proyecto</span>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co" autoCapitalize="none" />
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Llave anónima (anon key)</span>
            <input value={anon} onChange={e => setAnon(e.target.value)}
              placeholder="eyJhbGciOi..." autoCapitalize="none" />
          </label>
          <button className="btn-primario" onClick={guardarConexion}>Guardar conexión</button>
        </section>
      )}

      {/* Sesión */}
      {sesion ? (
        <section className="ajustes-bloque">
          <h2>Sesión activa</h2>
          <p className="ayuda">Conectado como:</p>
          <p style={{ fontWeight: 600, color: '#0F6E56', marginBottom: '16px' }}>{sesion}</p>
          <button className="btn-secundario" onClick={cerrarSesion}>Cerrar sesión</button>
        </section>
      ) : (
        <section className="ajustes-bloque">
          <h2>Iniciar sesión</h2>
          <p className="ayuda">Ingresa con el usuario y contraseña que te asignó el administrador.</p>
          <label className="campo">
            <span className="campo-etiqueta">Correo electrónico</span>
            <input value={correo} onChange={e => setCorreo(e.target.value)}
              type="email" placeholder="colaborador@ejemplo.com"
              autoComplete="email" autoCapitalize="none" />
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Contraseña</span>
            <input value={clave} onChange={e => setClave(e.target.value)}
              type="password" placeholder="••••••••"
              autoComplete="current-password" />
          </label>
          <button className="btn-primario" onClick={iniciarSesion}>Iniciar sesión</button>
        </section>
      )}

      {mensaje && <p className="mensaje-sync">{mensaje}</p>}
    </div>
  );
}
