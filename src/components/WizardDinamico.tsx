import { useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import type { FormularioDinamico, CampoDinamico } from '../generico/tipos';
import { evaluarCondicionDinamica, evaluarFormulaDinamica } from '../generico/tipos';
import type { RegistroGenerico } from '../generico/tipos';
import { guardarRegistro } from '../db';
import { SignatureCanvas } from './SignatureCanvas';
import { PhotoCapture } from './PhotoCapture';

// ── Componentes de campo individuales ────────────────────────────────────────

function CampoDinamicoRender({
  campo, datos, onChange,
}: {
  campo: CampoDinamico;
  datos: Record<string, string>;
  onChange: (key: string, valor: string) => void;
}) {
  const valor = campo.tipo === 'calculado'
    ? evaluarFormulaDinamica(campo.formula ?? '', datos)
    : datos[campo.key] ?? campo.valorDefecto ?? '';

  const set = (v: string) => onChange(campo.key, v);
  const col = campo.ancho === 'completo' ? { gridColumn: '1 / -1' } : undefined;

  if (campo.tipo === 'separador') return (
    <div className="campo ancho-completo" style={{ gridColumn: '1 / -1', borderBottom: '1px solid #d1d5db', paddingBottom: '4px', marginTop: '4px' }}>
      <span style={{ fontWeight: 600, color: '#1a3a2f' }}>{campo.etiqueta}</span>
    </div>
  );

  if (campo.tipo === 'instruccion') return (
    <div className="campo ancho-completo" style={{ gridColumn: '1 / -1', background: '#eff6ff', borderRadius: '8px', padding: '10px 12px', color: '#1e40af', fontSize: '0.875rem' }}>
      {campo.placeholder || campo.etiqueta}
    </div>
  );

  if (campo.tipo === 'calculado') return (
    <div className="campo" style={col}>
      <span className="campo-etiqueta">{campo.etiqueta}</span>
      <div className="campo-calculado">{valor || '—'}</div>
    </div>
  );

  if (campo.tipo === 'sino') return (
    <div className="campo" style={col}>
      <span className="campo-etiqueta">
        {campo.etiqueta}{campo.obligatorio ? ' *' : ''}
      </span>
      <div style={{ display: 'flex', gap: '8px' }}>
        {['Si', 'No'].map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => set(op)}
            className={valor === op ? 'btn-primario' : 'btn-secundario'}
            style={{ flex: 1 }}
          >
            {op}
          </button>
        ))}
      </div>
      {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
    </div>
  );

  if (['select', 'radio'].includes(campo.tipo)) {
    const opciones = campo.opciones ?? [];
    if (campo.tipo === 'select') return (
      <div className="campo" style={col}>
        <label className="campo-etiqueta">{campo.etiqueta}{campo.obligatorio ? ' *' : ''}</label>
        <select className="campo-input" value={valor} onChange={(e) => set(e.target.value)}>
          <option value="">Seleccionar...</option>
          {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </select>
        {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
      </div>
    );
    return (
      <div className="campo" style={col}>
        <span className="campo-etiqueta">{campo.etiqueta}{campo.obligatorio ? ' *' : ''}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {opciones.map((o) => (
            <label key={o.valor} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name={campo.key} value={o.valor}
                checked={valor === o.valor} onChange={() => set(o.valor)} />
              <span>{o.etiqueta}</span>
            </label>
          ))}
        </div>
        {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
      </div>
    );
  }

  if (campo.tipo === 'checkbox') {
    const opciones = campo.opciones ?? [];
    const seleccionados = valor ? valor.split(',').filter(Boolean) : [];
    return (
      <div className="campo" style={col}>
        <span className="campo-etiqueta">{campo.etiqueta}{campo.obligatorio ? ' *' : ''}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {opciones.map((o) => (
            <label key={o.valor} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={seleccionados.includes(o.valor)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...seleccionados, o.valor]
                    : seleccionados.filter((v) => v !== o.valor);
                  set(next.join(','));
                }} />
              <span>{o.etiqueta}</span>
            </label>
          ))}
        </div>
        {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
      </div>
    );
  }

  if (campo.tipo === 'calificacion') {
    const stars = (campo.config?.stars as number) || 5;
    return (
      <div className="campo" style={col}>
        <span className="campo-etiqueta">{campo.etiqueta}{campo.obligatorio ? ' *' : ''}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: stars }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" onClick={() => set(String(n))}
              style={{ fontSize: '1.75rem', background: 'none', border: 'none', cursor: 'pointer',
                color: Number(valor) >= n ? '#f59e0b' : '#d1d5db' }}>
              ★
            </button>
          ))}
        </div>
        {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
      </div>
    );
  }

  if (campo.tipo === 'parrafo') return (
    <div className="campo" style={col}>
      <label className="campo-etiqueta">{campo.etiqueta}{campo.obligatorio ? ' *' : ''}</label>
      <textarea className="campo-input" rows={3} value={valor}
        onChange={(e) => set(e.target.value)} placeholder={campo.placeholder} />
      {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
    </div>
  );

  const tipoInput: Record<string, string> = {
    fecha: 'date', hora: 'time', email: 'email', tel: 'tel',
    numero: 'number', decimal: 'number',
  };
  const inputType = tipoInput[campo.tipo] || 'text';
  const min = campo.config?.min as string | undefined;
  const max = campo.config?.max as string | undefined;

  return (
    <div className="campo" style={col}>
      <label className="campo-etiqueta">{campo.etiqueta}{campo.obligatorio ? ' *' : ''}</label>
      <input
        type={inputType}
        className="campo-input"
        value={valor}
        onChange={(e) => set(e.target.value)}
        placeholder={campo.placeholder}
        step={campo.tipo === 'decimal' ? '0.01' : undefined}
        min={min}
        max={max}
      />
      {campo.ayuda && <span className="campo-ayuda">{campo.ayuda}</span>}
    </div>
  );
}

// ── Wizard principal ──────────────────────────────────────────────────────────

export function WizardDinamico({
  formulario, inicial, onSalir,
}: {
  formulario: FormularioDinamico;
  inicial: RegistroGenerico;
  onSalir: () => void;
}) {
  const [registro, setRegistro] = useState<RegistroGenerico>(inicial);
  const [paso, setPaso] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [gpsEstados, setGpsEstados] = useState<Record<string, string>>({});

  const secciones = formulario.schema.secciones;

  useEffect(() => {
    const t = setTimeout(() => { guardarRegistro(registro); }, 500);
    return () => clearTimeout(t);
  }, [registro]);

  const setCampo = (key: string, valor: string) => {
    setRegistro((prev) => ({ ...prev, datos: { ...prev.datos, [key]: valor } }));
  };

  const capturarGPS = async (campoKey?: string) => {
    const stateKey = campoKey ?? '__sec';
    setGpsEstados((prev) => ({ ...prev, [stateKey]: 'Buscando señal GPS...' }));
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      if (campoKey) {
        setCampo(campoKey, `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`);
      } else {
        setRegistro((prev) => ({
          ...prev,
          datos: {
            ...prev.datos,
            latitud: pos.coords.latitude.toFixed(6),
            longitud: pos.coords.longitude.toFixed(6),
          },
        }));
      }
      setGpsEstados((prev) => ({ ...prev, [stateKey]: '📍 Ubicación capturada' }));
    } catch {
      setGpsEstados((prev) => ({ ...prev, [stateKey]: 'No se pudo obtener el GPS. Revisa permisos.' }));
    }
  };

  const guardarYSalir = async () => {
    setGuardando(true);
    await guardarRegistro(registro);
    setGuardando(false);
    onSalir();
  };

  const seccionActual = secciones[paso];
  const esUltimo = paso === secciones.length - 1;
  const titulo = registro.datos[formulario.schema.claveNombre] || `Nuevo — ${formulario.nombre}`;
  const subtitulo = formulario.schema.claveSubtitulo ? registro.datos[formulario.schema.claveSubtitulo] : '';

  const camposVisibles = seccionActual.campos.filter((c) =>
    evaluarCondicionDinamica(c.condicion, registro.datos)
  );

  return (
    <div className="wizard">
      <div className="wizard-encabezado">
        <button className="btn-texto" onClick={guardarYSalir}>← Guardar y volver</button>
        <span className="wizard-titulo">
          {formulario.icono} {titulo}
          {subtitulo && <span style={{ opacity: 0.6, fontWeight: 400 }}> · {subtitulo}</span>}
        </span>
      </div>

      <div className="stepper">
        {secciones.map((s, i) => (
          <button
            key={s.id}
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
        {seccionActual.descripcion && (
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '12px' }}>
            {seccionActual.descripcion}
          </p>
        )}

        {seccionActual.conGPS && (
          <div className="campo ancho-completo campo-gps">
            <button type="button" className="btn-secundario" onClick={() => capturarGPS()}>
              📍 Capturar ubicación GPS
            </button>
            <div className="gps-lectura">
              <span>Lat: {registro.datos.latitud || '—'}</span>
              <span>Lon: {registro.datos.longitud || '—'}</span>
            </div>
            {gpsEstados['__sec'] && <p className="gps-estado">{gpsEstados['__sec']}</p>}
          </div>
        )}

        <div className="grid-campos">
          {camposVisibles.map((campo) => {
            if (campo.tipo === 'gps') {
              const gpsVal = registro.datos[campo.key] || '';
              const [lat, lon] = gpsVal ? gpsVal.split(',') : ['', ''];
              return (
                <div key={campo.key} className="campo ancho-completo">
                  <span className="campo-etiqueta">📍 {campo.etiqueta}</span>
                  <button type="button" className="btn-secundario" onClick={() => capturarGPS(campo.key)}>
                    Capturar GPS
                  </button>
                  {gpsVal && (
                    <div className="gps-lectura">
                      <span>Lat: {lat || '—'}</span>
                      <span>Lon: {lon || '—'}</span>
                    </div>
                  )}
                  {gpsEstados[campo.key] && <p className="gps-estado">{gpsEstados[campo.key]}</p>}
                </div>
              );
            }
            if (campo.tipo === 'firma') {
              return (
                <div key={campo.key} className="campo ancho-completo">
                  <span className="campo-etiqueta">✍ {campo.etiqueta}{campo.obligatorio ? ' *' : ''}</span>
                  <SignatureCanvas
                    value={registro.datos[campo.key] || ''}
                    onChange={(b64) => setCampo(campo.key, b64)}
                  />
                </div>
              );
            }
            if (campo.tipo === 'foto') {
              const fotos: string[] = (() => {
                try { return JSON.parse(registro.datos[campo.key] || '[]'); } catch { return []; }
              })();
              return (
                <div key={campo.key} className="campo ancho-completo">
                  <span className="campo-etiqueta">📷 {campo.etiqueta}{campo.obligatorio ? ' *' : ''}</span>
                  <PhotoCapture
                    value={fotos}
                    onChange={(arr) => setCampo(campo.key, JSON.stringify(arr))}
                    maxFotos={campo.maxFotos ?? 5}
                  />
                </div>
              );
            }
            return (
              <CampoDinamicoRender
                key={campo.key}
                campo={campo}
                datos={registro.datos}
                onChange={setCampo}
              />
            );
          })}
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
