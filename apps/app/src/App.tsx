import { useEffect, useState } from 'react';
import { pedirPermisoUbicacion } from './lib/gps.ts';
import { pedirAlmacenamientoPersistente } from './lib/db.ts';
import { ProveedorSesion, useSesion } from './lib/sesion.tsx';
import { configurado } from './lib/supabase.ts';
import { type FormularioLocal } from './lib/db.ts';
import { Entrar, ElegirOrg } from './pantallas/Entrar.tsx';
import { Inicio } from './pantallas/Inicio.tsx';
import { Lista } from './pantallas/Lista.tsx';
import { Encuesta, nuevaEncuesta } from './pantallas/Encuesta.tsx';
import { Ajustes } from './pantallas/Ajustes.tsx';

type Vista =
  | { tipo: 'inicio' }
  | { tipo: 'ajustes' }
  | { tipo: 'lista'; form: FormularioLocal }
  | { tipo: 'encuesta'; form: FormularioLocal; registroId: string };

function Pantallas() {
  const { sesion, cargando, org } = useSesion();
  const [vista, setVista] = useState<Vista>({ tipo: 'inicio' });

  useEffect(() => { if (sesion) pedirPermisoUbicacion(); }, [sesion]);
  useEffect(() => { pedirAlmacenamientoPersistente(); }, []);

  if (!configurado) {
    return <p className="p-6 text-center text-gray-600">Esta versión de la app no trae la conexión al servidor. Pide un APK actualizado.</p>;
  }
  if (cargando) return null;
  if (!sesion) return <Entrar />;
  if (!org) return <ElegirOrg />;

  switch (vista.tipo) {
    case 'ajustes':
      return <Ajustes onVolver={() => setVista({ tipo: 'inicio' })} />;
    case 'lista':
      return (
        <Lista
          userId={sesion.user.id}
          form={vista.form}
          onVolver={() => setVista({ tipo: 'inicio' })}
          onAbrir={(registroId) => setVista({ tipo: 'encuesta', form: vista.form, registroId })}
          onNueva={async () => setVista({ tipo: 'encuesta', form: vista.form, registroId: await nuevaEncuesta(vista.form, sesion.user.id) })}
        />
      );
    case 'encuesta':
      return <Encuesta registroId={vista.registroId} onSalir={() => setVista({ tipo: 'lista', form: vista.form })} />;
    default:
      return <Inicio onAjustes={() => setVista({ tipo: 'ajustes' })} onFormulario={(form) => setVista({ tipo: 'lista', form })} />;
  }
}

export default function App() {
  return (
    <ProveedorSesion>
      <div className="relative mx-auto h-full max-w-xl bg-geo-gray">
        <Pantallas />
      </div>
    </ProveedorSesion>
  );
}
