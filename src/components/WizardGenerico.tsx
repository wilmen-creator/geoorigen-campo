import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { EsquemaRegistro, RegistroGenerico } from '../generico/tipos';
import { campoVisible } from '../generico/tipos';
import { guardarRegistro } from '../db';
import { CampoDesdeEsquema } from './CampoDesdeEsquema';

export function WizardGenerico({
  esquema, inicial, onSalir,
}: {
  esquema: EsquemaRegistro;
  inicial: RegistroGenerico;
  onSalir: () => void;
}) {
  const [registro, setRegistro] = useState<RegistroGenerico>(inicial);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [gpsEstado, setGpsEstado] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { guardarRegistro(registro); }, 500);
    return () => clearTimeout(t);
  }, [registro]);

  const setCampo = (key: string, valor: string) => {
    setRegistro((prev) => ({ ...prev, datos: { ...prev.datos, [key]: valor } }));
  };

  const capturarGPS = async () => {
    setGpsEstado('Buscando señal GPS...');
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      setRegistro((prev) => ({
        ...prev,
        datos: {
          ...prev.datos,
          latitud: pos.coords.latitude.toFixed(6),
          longitud: pos.coords.longitude.toFixed(6),
          altitud: prev.datos.altitud || String(Math.round(pos.coords.altitude || 0)),
        },
      }));
      setGpsEstado('Ubicación capturada.');
    } catch {
      setGpsEstado('No se pudo obtener el GPS. Revisa permisos de ubicación.');
    }
  };

  const guardarYSalir = async () => {
    setGuardando(true);
    await guardarRegistro(registro);
    setGuardando(false);
    onSalir();
  };

  const secciones = esquema.secciones;
  const seccionActual = secciones[paso];
  const esUltimo = paso === secciones.length - 1;
  const titulo = registro.datos[esquema.claveNombre] || `Nuevo registro — ${esquema.nombre}`;

  return (
    <div className="wizard">
      <div className="wizard-encabezado">
        <button className="btn-texto" onClick={guardarYSalir}>← Guardar y volver</button>
        <span className="wizard-titulo">{titulo}</span>
      </div>

      <div className="stepper">
        {secciones.map((s, i) => (
          <button
            key={s.titulo}
            className={`step ${i === paso ? 'activo' : ''} ${i < paso ? 'completo' : ''}`}
            onClick={() => setPaso(i)}
          >
            <span className="step-numero">{i + 1}</span>
            <span className="step-nombre">{s.titulo.replace(/^\d+\.\s*/, '')}</span>
          </button>
        ))}
      </div>

      <div className="wizard-cuerpo">
        <h2 className="seccion-titulo">{seccionActual.titulo}</h2>

        {seccionActual.conGPS && (
          <div className="campo ancho-completo campo-gps">
            <button type="button" className="btn-secundario" onClick={capturarGPS}>
              📍 Capturar ubicación GPS
            </button>
            <div className="gps-lectura">
              <span>Lat: {registro.datos.latitud || '—'}</span>
              <span>Lon: {registro.datos.longitud || '—'}</span>
            </div>
            {gpsEstado && <p className="gps-estado">{gpsEstado}</p>}
          </div>
        )}

        <div className="grid-campos">
          {seccionActual.campos
            .filter((campo) => campoVisible(campo, registro.datos))
            .map((campo) => (
              <CampoDesdeEsquema key={campo.key} campo={campo} datos={registro.datos} onChange={setCampo} />
            ))}
        </div>
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
            {guardando ? 'Guardando...' : 'Guardar registro'}
          </button>
        )}
      </div>
    </div>
  );
}
