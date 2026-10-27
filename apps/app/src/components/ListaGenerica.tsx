import type { EsquemaRegistro, RegistroGenerico } from '../generico/tipos';

export function ListaGenerica({
  esquema, registros, onAbrir, onNueva, onBorrar, onVolver, onSincronizar,
  sincronizando, mensajeSync, enLinea,
}: {
  esquema: EsquemaRegistro;
  registros: RegistroGenerico[];
  onAbrir: (r: RegistroGenerico) => void;
  onNueva: () => void;
  onBorrar: (id: string) => void;
  onVolver: () => void;
  onSincronizar: () => void;
  sincronizando: boolean;
  mensajeSync: string;
  enLinea: boolean;
}) {
  const pendientes = registros.filter((r) => !r.sincronizado).length;

  return (
    <div className="lista-contenedor">
      <header className="app-header">
        <button className="btn-texto" onClick={onVolver}>← Inicio</button>
        <div>
          <h1>{esquema.icono} {esquema.nombre}</h1>
        </div>
        <span />
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
        + Nuevo registro
      </button>

      <ul className="lista-encuestas">
        {registros.length === 0 && (
          <li className="lista-vacia">Aún no hay registros. Toca "Nuevo registro" para empezar.</li>
        )}
        {registros.map((r) => (
          <li key={r.id} className="tarjeta-encuesta" onClick={() => onAbrir(r)}>
            <div className="tarjeta-info">
              <strong>{r.datos[esquema.claveNombre] || 'Sin nombre'}</strong>
              <span>{r.datos[esquema.claveSubtitulo] || ''}</span>
              <span className="fecha">{new Date(r.actualizado_en).toLocaleString('es-CO')}</span>
            </div>
            <div className="tarjeta-acciones">
              <span className={`sello ${r.sincronizado ? 'sincronizado' : 'borrador'}`}>
                {r.sincronizado ? 'SINCRONIZADO' : 'BORRADOR'}
              </span>
              <button
                className="btn-borrar"
                onClick={(ev) => { ev.stopPropagation(); onBorrar(r.id); }}
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
