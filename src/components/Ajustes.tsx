import { useEffect, useState } from 'react';
import { getSupabase } from '../supabase';

export function Ajustes({ onVolver }: { onVolver: () => void }) {
  const [correo, setCorreo]   = useState('');
  const [clave, setClave]     = useState('');
  const [mensaje, setMensaje] = useState('');
  const [sesion, setSesion]   = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getSupabase().then((sb) => {
      if (!sb) { setCargando(false); return; }
      sb.auth.getSession().then(({ data }) => {
        setSesion(data.session?.user.email || '');
        setCargando(false);
      });
    });
  }, []);

  const iniciarSesion = async () => {
    setMensaje('Conectando...');
    const sb = await getSupabase();
    if (!sb) { setMensaje('Error de configuración interna.'); return; }
    const { data, error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
    if (error) { setMensaje(`Error: ${error.message}`); return; }
    setSesion(data.user?.email || '');
    setMensaje('Sesión iniciada correctamente.');
    setClave('');
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
            <input
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              type="email"
              placeholder="colaborador@ejemplo.com"
              autoComplete="email"
            />
          </label>
          <label className="campo">
            <span className="campo-etiqueta">Contraseña</span>
            <input
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <button className="btn-primario" onClick={iniciarSesion}>Iniciar sesión</button>
        </section>
      )}

      {mensaje && <p className="mensaje-sync">{mensaje}</p>}
    </div>
  );
}
