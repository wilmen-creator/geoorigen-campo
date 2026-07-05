import { esquemaCacao } from '../generico/schema-cacao';
import type { FormularioDinamico } from '../generico/tipos';

export function Inicio({
  onCafe, onCacao, onAjustes, conteoCafe, conteoCacao,
  formularios, onFormulario, onSincronizarFormularios, sincronizandoFormularios, enLinea,
}: {
  onCafe: () => void;
  onCacao: () => void;
  onAjustes: () => void;
  conteoCafe: number;
  conteoCacao: number;
  formularios: FormularioDinamico[];
  onFormulario: (f: FormularioDinamico) => void;
  onSincronizarFormularios: () => void;
  sincronizandoFormularios: boolean;
  enLinea: boolean;
}) {
  return (
    <div className="lista-contenedor">
      <header className="app-header">
        <div>
          <h1>GeoOrigen Campo</h1>
          <p className="subtitulo">Elige el tipo de registro</p>
        </div>
        <button className="btn-ajustes" onClick={onAjustes} aria-label="Ajustes">⚙</button>
      </header>

      <div className="tarjetas-inicio">
        <button className="tarjeta-modulo" onClick={onCafe}>
          <span className="tarjeta-modulo-icono">☕</span>
          <span className="tarjeta-modulo-nombre">Línea Base Café</span>
          <span className="tarjeta-modulo-conteo">{conteoCafe} registro(s)</span>
        </button>

        <button className="tarjeta-modulo" onClick={onCacao}>
          <span className="tarjeta-modulo-icono">{esquemaCacao.icono}</span>
          <span className="tarjeta-modulo-nombre">{esquemaCacao.nombre}</span>
          <span className="tarjeta-modulo-conteo">{conteoCacao} registro(s)</span>
        </button>

        {formularios.map((f) => (
          <button key={f.id} className="tarjeta-modulo" onClick={() => onFormulario(f)}>
            <span className="tarjeta-modulo-icono">{f.icono || '📋'}</span>
            <span className="tarjeta-modulo-nombre">{f.nombre}</span>
            <span className="tarjeta-modulo-conteo">v{f.version}</span>
          </button>
        ))}
      </div>

      {/* Botón para descargar formularios */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <button
          className="btn-secundario"
          onClick={onSincronizarFormularios}
          disabled={sincronizandoFormularios || !enLinea}
          style={{ fontSize: '0.875rem' }}
        >
          {sincronizandoFormularios ? '⟳ Actualizando formularios...' : '⬇ Actualizar formularios'}
        </button>
        {!enLinea && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '6px' }}>
            Sin conexión — usando formularios guardados
          </p>
        )}
      </div>
    </div>
  );
}
