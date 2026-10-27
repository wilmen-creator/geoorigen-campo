import { useState, type FormEvent, type ReactNode } from 'react';
import { supabase, mensajeError } from '../lib/supabase.ts';
import { useSesion } from '../lib/sesion.tsx';

type Modo = 'entrar' | 'olvide';

function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-5 p-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">GeoOrigen Campo</p>
          <h1 className="mt-1 text-xl font-bold">{titulo}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Entrar() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (err) setError(mensajeError(err));
  };

  const pedirEnlace = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: window.location.origin });
    setEnviando(false);
    // Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados
    setAviso('Si el correo tiene una cuenta, te llegará un enlace para crear una contraseña nueva.');
  };

  if (modo === 'olvide') {
    return (
      <Tarjeta titulo="Recuperar contraseña">
        {aviso ? (
          <p className="rounded-lg bg-primary-light px-3 py-2 text-sm text-primary">{aviso}</p>
        ) : (
          <form onSubmit={pedirEnlace} className="space-y-3">
            <div>
              <label className="label" htmlFor="correo">Correo</label>
              <input id="correo" type="email" required className="input" value={correo}
                onChange={(e) => setCorreo(e.target.value)} autoComplete="email" />
            </div>
            <button className="btn-primary w-full" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <button className="text-sm text-primary hover:underline" onClick={() => { setModo('entrar'); setAviso(''); }}>
          ← Volver a entrar
        </button>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Panel de administración">
      <form onSubmit={entrar} className="space-y-3">
        <div>
          <label className="label" htmlFor="correo">Correo</label>
          <input id="correo" type="email" required className="input" value={correo}
            onChange={(e) => setCorreo(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="clave">Contraseña</label>
          <input id="clave" type="password" required className="input" value={clave}
            onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <button className="text-sm text-primary hover:underline" onClick={() => { setModo('olvide'); setError(''); }}>
        ¿Olvidaste tu contraseña?
      </button>
    </Tarjeta>
  );
}

export function NuevaClave() {
  const { terminarRecuperacion } = useSesion();
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) return setError('Mínimo 8 caracteres');
    if (clave !== repetir) return setError('Las contraseñas no coinciden');
    setEnviando(true);
    const { error: err } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (err) return setError(mensajeError(err));
    terminarRecuperacion();
  };

  return (
    <Tarjeta titulo="Crea tu contraseña nueva">
      <form onSubmit={guardar} className="space-y-3">
        <div>
          <label className="label" htmlFor="clave">Contraseña nueva</label>
          <input id="clave" type="password" className="input" value={clave}
            onChange={(e) => setClave(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="repetir">Repítela</label>
          <input id="repetir" type="password" className="input" value={repetir}
            onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </Tarjeta>
  );
}

export function SinConfigurar() {
  return (
    <Tarjeta titulo="Falta la configuración">
      <p className="text-sm text-gray-600">
        Crea el archivo <code className="rounded bg-geo-gray px-1">apps/panel/.env.local</code> a partir de{' '}
        <code className="rounded bg-geo-gray px-1">.env.example</code> con la URL y la llave anon del proyecto
        Supabase <strong>geoorigen-campo</strong>.
      </p>
    </Tarjeta>
  );
}

export function SinAcceso() {
  const { salir, membresias, org } = useSesion();
  const esColaborador = org?.rol === 'colaborador';
  return (
    <Tarjeta titulo={esColaborador ? 'Usa la app de campo' : 'Sin organización'}>
      <p className="text-sm text-gray-600">
        {esColaborador
          ? 'Tu cuenta es de colaborador de campo: las encuestas se llenan desde la app en el celular.'
          : membresias.length === 0
            ? 'Tu cuenta todavía no pertenece a ninguna organización. Pide a un administrador que te invite.'
            : 'No tienes acceso al panel en esta organización.'}
      </p>
      <button className="btn-secondary w-full" onClick={salir}>Salir</button>
    </Tarjeta>
  );
}
