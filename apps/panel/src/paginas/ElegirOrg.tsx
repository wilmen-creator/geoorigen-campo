import { Building2, ChevronRight } from 'lucide-react';
import { useSesion } from '../lib/sesion.tsx';

export function ElegirOrg() {
  const { membresias, elegirOrg, salir } = useSesion();
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-4 p-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">GeoOrigen Campo</p>
          <h1 className="mt-1 text-xl font-bold">Elige una organización</h1>
        </div>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {membresias.map((m) => (
            <button key={m.org_id} onClick={() => elegirOrg(m.org_id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-geo-gray">
              <Building2 className="h-5 w-5 text-gray-400" />
              <span className="flex-1">
                <span className="block font-medium">{m.organizacion.nombre}</span>
                <span className="text-xs text-gray-400">{m.rol}{m.expira_en && ' · acceso de emergencia'}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          ))}
        </div>
        <button className="text-sm text-gray-500 hover:underline" onClick={salir}>Salir</button>
      </div>
    </div>
  );
}
