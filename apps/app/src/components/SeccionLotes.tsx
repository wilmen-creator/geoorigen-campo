import { useState } from 'react';
import type { Encuesta, LoteData } from '../types';
import { loteVacio } from '../types';
import { CampoTexto, CampoSelect, CampoNumero, CampoSiNo } from './Campos';
import { VARIEDADES, SOMBRIO } from '../opciones';

const MAX_LOTES = 5;

export function SeccionLotes({ e, actualizarLotes }: {
  e: Encuesta;
  actualizarLotes: (lotes: LoteData[]) => void;
}) {
  const [activo, setActivo] = useState(0);

  const setCampo = (idx: number, campo: keyof LoteData, valor: string) => {
    const copia = e.lotes.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l));
    actualizarLotes(copia);
  };

  const agregarLote = () => {
    if (e.lotes.length >= MAX_LOTES) return;
    actualizarLotes([...e.lotes, loteVacio()]);
    setActivo(e.lotes.length);
  };

  const quitarLote = (idx: number) => {
    if (e.lotes.length <= 1) return;
    const copia = e.lotes.filter((_, i) => i !== idx);
    actualizarLotes(copia);
    setActivo(Math.max(0, idx - 1));
  };

  const lote = e.lotes[activo];

  return (
    <div>
      <div className="pestanas-lotes">
        {e.lotes.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`pestana-lote ${i === activo ? 'activa' : ''}`}
            onClick={() => setActivo(i)}
          >
            Lote {i + 1}
          </button>
        ))}
        {e.lotes.length < MAX_LOTES && (
          <button type="button" className="pestana-lote agregar" onClick={agregarLote}>
            + Agregar lote
          </button>
        )}
      </div>

      <div className="grid-campos">
        <CampoTexto etiqueta="Nombre del lote" valor={lote.nombre} onChange={(v) => setCampo(activo, 'nombre', v)} ancho="completo" />
        <CampoSelect etiqueta="Variedad" valor={lote.variedad} onChange={(v) => setCampo(activo, 'variedad', v)} opciones={VARIEDADES} />
        {lote.variedad === 'Otra' && (
          <CampoTexto etiqueta="¿Cuál variedad?" valor={lote.var_otra} onChange={(v) => setCampo(activo, 'var_otra', v)} />
        )}
        <CampoSelect etiqueta="Sombrío" valor={lote.sombrio} onChange={(v) => setCampo(activo, 'sombrio', v)} opciones={SOMBRIO} />
        <CampoNumero etiqueta="Área en café (ha)" valor={lote.area_cafe} onChange={(v) => setCampo(activo, 'area_cafe', v)} />
        <CampoNumero etiqueta="Número de plantas" valor={lote.num_plant} onChange={(v) => setCampo(activo, 'num_plant', v)} />
        <CampoNumero etiqueta="Edad (años)" valor={lote.edad} onChange={(v) => setCampo(activo, 'edad', v)} />
        <CampoNumero etiqueta="Distancia entre calles (m)" valor={lote.dist_calle} onChange={(v) => setCampo(activo, 'dist_calle', v)} />
        <CampoNumero etiqueta="Distancia entre plantas (m)" valor={lote.dist_plant} onChange={(v) => setCampo(activo, 'dist_plant', v)} />
        <CampoSiNo etiqueta="¿Productivo?" valor={lote.productivo} onChange={(v) => setCampo(activo, 'productivo', v)} />
      </div>

      {e.lotes.length > 1 && (
        <button type="button" className="btn-quitar-lote" onClick={() => quitarLote(activo)}>
          Quitar Lote {activo + 1}
        </button>
      )}
    </div>
  );
}
