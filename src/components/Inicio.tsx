import { esquemaCacao } from '../generico/schema-cacao';

export function Inicio({
  onCafe, onCacao, onAjustes, conteoCafe, conteoCacao,
}: {
  onCafe: () => void;
  onCacao: () => void;
  onAjustes: () => void;
  conteoCafe: number;
  conteoCacao: number;
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
      </div>
    </div>
  );
}
