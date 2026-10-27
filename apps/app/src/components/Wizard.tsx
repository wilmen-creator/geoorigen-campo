import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { Encuesta, LoteData } from '../types';
import { guardarEncuesta } from '../db';
import { SeccionProductor, SeccionFinca, SeccionInfraestructura } from './SeccionProductor';
import { SeccionLotes } from './SeccionLotes';
import { SeccionCosecha, SeccionCalidad } from './SeccionCosecha';

const SECCIONES = ['Productor', 'Finca', 'Infraestr.', 'Lotes', 'Cosecha', 'Calidad'];

export function Wizard({ inicial, onSalir }: { inicial: Encuesta; onSalir: () => void }) {
  const [encuesta, setEncuesta] = useState<Encuesta>(inicial);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [gpsEstado, setGpsEstado] = useState('');

  // autoguardado cada vez que cambia algo (debounced simple)
  useEffect(() => {
    const t = setTimeout(() => {
      guardarEncuesta(encuesta);
    }, 500);
    return () => clearTimeout(t);
  }, [encuesta]);

  const set = (k: keyof Encuesta, v: string) => {
    setEncuesta((prev) => ({ ...prev, [k]: v }));
  };

  const actualizarLotes = (lotes: LoteData[]) => {
    setEncuesta((prev) => ({ ...prev, lotes }));
  };

  const capturarGPS = async () => {
    setGpsEstado('Buscando señal GPS...');
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      setEncuesta((prev) => ({
        ...prev,
        latitud: pos.coords.latitude.toFixed(6),
        longitud: pos.coords.longitude.toFixed(6),
        altitud_msnm: prev.altitud_msnm || String(Math.round(pos.coords.altitude || 0)),
      }));
      setGpsEstado('Ubicación capturada.');
    } catch (err) {
      setGpsEstado('No se pudo obtener el GPS. Revisa permisos de ubicación.');
    }
  };

  const guardarYSalir = async () => {
    setGuardando(true);
    await guardarEncuesta(encuesta);
    setGuardando(false);
    onSalir();
  };

  const esUltimo = paso === SECCIONES.length - 1;

  return (
    <div className="wizard">
      <div className="wizard-encabezado">
        <button className="btn-texto" onClick={guardarYSalir}>← Guardar y volver</button>
        <span className="wizard-titulo">{encuesta.nombre || 'Nueva encuesta'}</span>
      </div>

      <div className="stepper">
        {SECCIONES.map((s, i) => (
          <button
            key={s}
            className={`step ${i === paso ? 'activo' : ''} ${i < paso ? 'completo' : ''}`}
            onClick={() => setPaso(i)}
          >
            <span className="step-numero">{i + 1}</span>
            <span className="step-nombre">{s}</span>
          </button>
        ))}
      </div>

      <div className="wizard-cuerpo">
        {paso === 0 && <SeccionProductor e={encuesta} set={set} />}
        {paso === 1 && <SeccionFinca e={encuesta} set={set} capturarGPS={capturarGPS} />}
        {paso === 2 && <SeccionInfraestructura e={encuesta} set={set} />}
        {paso === 3 && <SeccionLotes e={encuesta} actualizarLotes={actualizarLotes} />}
        {paso === 4 && <SeccionCosecha e={encuesta} set={set} />}
        {paso === 5 && <SeccionCalidad e={encuesta} set={set} />}
        {gpsEstado && paso === 1 && <p className="gps-estado">{gpsEstado}</p>}
      </div>

      <div className="wizard-pie">
        <button className="btn-secundario" disabled={paso === 0} onClick={() => setPaso((p) => p - 1)}>
          Atrás
        </button>
        {!esUltimo ? (
          <button className="btn-primario" onClick={() => setPaso((p) => p + 1)}>
            Siguiente
          </button>
        ) : (
          <button className="btn-primario" disabled={guardando} onClick={guardarYSalir}>
            {guardando ? 'Guardando...' : 'Guardar encuesta'}
          </button>
        )}
      </div>
    </div>
  );
}
