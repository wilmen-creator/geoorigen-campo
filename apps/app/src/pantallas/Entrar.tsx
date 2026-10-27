import { useState, type FormEvent } from 'react';
import { supabase, aCorreo, mensajeError } from '../lib/supabase.ts';
import { useSesion } from '../lib/sesion.tsx';

export function Entrar() {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEntrando(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: aCorreo(usuario), password: clave });
    setEntrando(false);
    if (err) setError(mensajeError(err));
  };

  return (
    <div className="flex min-h-full flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <p className="text-4xl">🌱</p>
        <h1 className="mt-2 text-2xl font-bold text-primary">GeoOrigen Campo</h1>
        <p className="text-sm text-gray-500">Encuestas en finca, con o sin señal</p>
      </div>
      <form onSubmit={entrar} className="tarjeta space-y-4">
        <div>
          <label className="etiqueta" htmlFor="usuario">Usuario o correo</label>
          <input id="usuario" className="entrada" autoCapitalize="none" autoCorrect="off" autoComplete="username"
            value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
        </div>
        <div>
          <label className="etiqueta" htmlFor="clave">Contraseña</label>
          <input id="clave" className="entrada" type="password" autoComplete="current-password"
            value={clave} onChange={(e) => setClave(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primario w-full" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="mt-4 text-center text-xs text-gray-400">¿Olvidaste la contraseña? Pídele al administrador que te la cambie.</p>
    </div>
  );
}

export function ElegirOrg() {
  const { membresias, elegirOrg, salir } = useSesion();
  return (
    <div className="flex min-h-full flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-bold">¿Con qué organización vas a trabajar?</h1>
      {membresias.length === 0 ? (
        <p className="tarjeta text-sm text-gray-600">
          Tu cuenta aún no pertenece a ninguna organización. Pide al administrador que te agregue y vuelve a entrar con señal.
        </p>
      ) : membresias.map((m) => (
        <button key={m.org_id} className="tarjeta text-left active:bg-geo-gray" onClick={() => elegirOrg(m.org_id)}>
          <p className="font-semibold">{m.nombre}</p>
          <p className="text-xs text-gray-500">{m.rol}</p>
        </button>
      ))}
      <button className="text-sm text-gray-500" onClick={salir}>Salir</button>
    </div>
  );
}
