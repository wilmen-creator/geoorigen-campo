// Estructura del panel: barra lateral con módulos y organización activa.

import { NavLink, Outlet } from 'react-router';
import { ClipboardList, Users, Table2, LayoutDashboard, LogOut, Building2, Globe2, AlertTriangle } from 'lucide-react';
import { useSesion, estadoLicencia } from '../lib/sesion.tsx';

const MODULOS = [
  { a: '/tablero', texto: 'Tablero', icono: LayoutDashboard, listo: true },
  { a: '/datos', texto: 'Datos', icono: Table2, listo: true },
  { a: '/formularios', texto: 'Formularios', icono: ClipboardList, listo: true },
  { a: '/equipo', texto: 'Equipo', icono: Users, listo: true },
];

const ROLES: Record<string, string> = {
  admin: 'Administrador', editor: 'Editor', lector: 'Lector', colaborador: 'Colaborador',
};

export function Marco() {
  const { sesion, org, membresias, elegirOrg, salir, esPlataformaAdmin } = useSesion();
  const licencia = org ? estadoLicencia(org.organizacion) : null;
  const modulos = esPlataformaAdmin ? [...MODULOS, { a: '/plataforma', texto: 'Plataforma', icono: Globe2, listo: true }] : MODULOS;

  return (
    <div className="flex h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-100 bg-white">
        <div className="border-b border-gray-100 px-4 py-4">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">GeoOrigen Campo</p>
          {membresias.length > 1 ? (
            <select
              className="input mt-2 py-1.5 font-semibold"
              value={org?.org_id ?? ''}
              onChange={(e) => elegirOrg(e.target.value)}
              aria-label="Organización"
            >
              {membresias.map((m) => (
                <option key={m.org_id} value={m.org_id}>{m.organizacion.nombre}</option>
              ))}
            </select>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-gray-400" /> {org?.organizacion.nombre}
            </p>
          )}
          {org && (
            <p className="mt-1 text-xs text-gray-400">
              {ROLES[org.rol]}
              {org.expira_en && ' · acceso de emergencia'}
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          {modulos.map(({ a, texto, icono: Icono, listo }) =>
            listo ? (
              <NavLink
                key={a}
                to={a}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-primary-light font-semibold text-primary' : 'text-gray-600 hover:bg-geo-gray'
                  }`
                }
              >
                <Icono className="h-4 w-4" /> {texto}
              </NavLink>
            ) : (
              <span key={a} className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-300"
                title="Próximamente">
                <Icono className="h-4 w-4" /> {texto}
                <span className="ml-auto text-[10px] tracking-wide uppercase">pronto</span>
              </span>
            ),
          )}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <p className="truncate px-1 text-xs text-gray-400" title={sesion?.user.email}>{sesion?.user.email}</p>
          <button onClick={salir}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-gray-500 hover:text-geo-text">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {licencia?.texto && (
          <p className={`flex items-center gap-2 px-4 py-2 text-sm ${licencia.vigente ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
            <AlertTriangle className="h-4 w-4 shrink-0" /> {licencia.texto}
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
