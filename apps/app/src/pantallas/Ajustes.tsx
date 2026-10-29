import { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, Building2 } from 'lucide-react';
import { useSesion } from '../lib/sesion.tsx';
import { contarPendientes } from '../lib/db.ts';

export function Ajustes({ onVolver }: { onVolver: () => void }) {
  const { sesion, org, membresias, elegirOrg, salir } = useSesion();
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (org) contarPendientes(org.org_id, sesion?.user.id).then((p) => setPendientes(p.registros + p.incompletas + p.archivos));
  }, [org, sesion]);

  const cerrarSesion = async () => {
    const aviso = pendientes
      ? `Tienes ${pendientes} cosa(s) sin subir. Se quedan guardadas en este celular, pero solo se subirán cuando vuelvas a entrar. ¿Salir?`
      : '¿Cerrar sesión?';
    if (confirm(aviso)) await salir();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 bg-primary px-3 py-3 text-white">
        <button onClick={onVolver} className="rounded-lg p-1 active:bg-white/20" aria-label="Volver"><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="text-lg font-bold">Ajustes</h1>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="tarjeta space-y-1">
          <p className="text-xs text-gray-500 uppercase">Sesión</p>
          <p className="font-medium">{sesion?.user.email?.replace('@sin-correo.geoorigen.com', '')}</p>
          <p className="text-sm text-gray-500">{org?.nombre} · {org?.rol}</p>
        </div>

        {membresias.length > 1 && (
          <div className="tarjeta space-y-2">
            <p className="text-xs text-gray-500 uppercase">Cambiar de organización</p>
            {membresias.map((m) => (
              <button key={m.org_id} onClick={() => { elegirOrg(m.org_id); onVolver(); }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left ${m.org_id === org?.org_id ? 'bg-primary-light text-primary' : 'active:bg-geo-gray'}`}>
                <Building2 className="h-4 w-4" /> {m.nombre}
              </button>
            ))}
          </div>
        )}

        <button className="btn-secundario w-full text-red-600" onClick={cerrarSesion}><LogOut className="h-5 w-5" /> Cerrar sesión</button>
        <p className="text-center text-xs text-gray-400">GeoOrigen Campo v{__VERSION_APP__}</p>
      </div>
    </div>
  );
}
