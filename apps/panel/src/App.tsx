import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ProveedorSesion, useSesion } from './lib/sesion.tsx';
import { configurado } from './lib/supabase.ts';
import { Entrar, NuevaClave, SinAcceso, SinConfigurar } from './paginas/Entrar.tsx';
import { ElegirOrg } from './paginas/ElegirOrg.tsx';
import { Formularios } from './paginas/Formularios.tsx';
import { Equipo } from './paginas/Equipo.tsx';
import { Datos } from './datos/Datos.tsx';
import { Tablero } from './tablero/Tablero.tsx';
import { Plataforma } from './paginas/Plataforma.tsx';
import { EditorFormulario } from './editor/EditorFormulario.tsx';
import { Marco } from './componentes/Marco.tsx';

function Rutas() {
  const { sesion, cargando, recuperando, membresias, org, esPlataformaAdmin } = useSesion();

  if (!configurado) return <SinConfigurar />;
  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
      </div>
    );
  }
  if (recuperando) return <NuevaClave />;
  if (!sesion) return <Entrar />;
  if (membresias.length === 0) return <SinAcceso />;
  if (!org) return <ElegirOrg />;
  if (org.rol === 'colaborador') return <SinAcceso />;

  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/formularios" element={<Formularios />} />
        <Route path="/formularios/:id" element={<EditorFormulario />} />
        <Route path="/equipo" element={<Equipo />} />
        <Route path="/tablero" element={<Tablero />} />
        {esPlataformaAdmin && <Route path="/plataforma" element={<Plataforma />} />}
        <Route path="/datos" element={<Datos />} />
        <Route path="*" element={<Navigate to="/formularios" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProveedorSesion>
        <Rutas />
      </ProveedorSesion>
    </BrowserRouter>
  );
}
