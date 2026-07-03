import type { Encuesta } from '../types';

export function ListaEncuestas({
  encuestas, onAbrir, onNueva, onBorrar, onSincronizar, onAjustes, onVolver,
  sincronizando, mensajeSync, enLinea,
}: {
  encuestas: Encuesta[];
  onAbrir: (e: Encuesta) => void;
  onNueva: () => void;
  onBorrar: (id: string) => void;
  onSincronizar: () => void;
  onAjustes: () => void;
  onVolver: () => void;
  sincronizando: boolean;
  mensajeSync: string;
  enLinea: boolean;
}) {
  const pendientes = encuestas.filter((e) => !e.sincronizado).length;

  return (
    <div className="lista-contenedor">
      <header className="app-header">
        <button className="btn-texto" onClick={onVolver}>← Inicio</button>
        <div>
          <h1>☕ Línea Base Café</h1>
        </div>
        <button className="btn-ajustes" onClick={onAjustes} aria-label="Ajustes">⚙</button>
      </header>

      <div className="barra-sync">
        <div className={`indicador-conexion ${enLinea ? 'online' : 'offline'}`}>
          <span className="punto" /> {enLinea ? 'En línea' : 'Sin conexión'}
        </div>
        <button className="btn-sync" onClick={onSincronizar} disabled={sincronizando || pendientes === 0}>
          {sincronizando ? 'Sincronizando...' : `Sincronizar (${pendientes})`}
        </button>
      </div>
      {mensajeSync && <p className="mensaje-sync">{mensajeSync}</p>}

      <button className="btn-nueva-encuesta" onClick={onNueva}>
        + Nueva encuesta
      </button>

      <ul className="lista-encuestas">
        {encuestas.length === 0 && (
          <li className="lista-vacia">Aún no hay encuestas. Toca "Nueva encuesta" para empezar.</li>
        )}
        {encuestas.map((e) => (
          <li key={e.id} className="tarjeta-encuesta" onClick={() => onAbrir(e)}>
            <div className="tarjeta-info">
              <strong>{e.nombre || 'Sin nombre'}</strong>
              <span>{e.finca || 'Sin finca'} · {e.dni || 'Sin documento'}</span>
              <span className="fecha">{new Date(e.actualizado_en).toLocaleString('es-CO')}</span>
            </div>
            <div className="tarjeta-acciones">
              <span className={`sello ${e.sincronizado ? 'sincronizado' : 'borrador'}`}>
                {e.sincronizado ? 'SINCRONIZADO' : 'BORRADOR'}
              </span>
              <button
                className="btn-borrar"
                onClick={(ev) => { ev.stopPropagation(); onBorrar(e.id); }}
                aria-label="Borrar"
              >
                🗑
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
