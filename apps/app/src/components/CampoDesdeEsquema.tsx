import type { CampoSchema } from '../generico/tipos';
import { CampoTexto, CampoSelect, CampoNumero, CampoSiNo, CampoTextoLargo } from './Campos';

export function CampoDesdeEsquema({
  campo, datos, onChange,
}: {
  campo: CampoSchema;
  datos: Record<string, string>;
  onChange: (key: string, valor: string) => void;
}) {
  const valor = datos[campo.key] ?? '';
  const set = (v: string) => onChange(campo.key, v);

  if (campo.tipo === 'calculado') {
    const resultado = campo.calcular ? campo.calcular(datos) : '';
    return (
      <div className="campo" style={campo.ancho === 'completo' ? { gridColumn: '1 / -1' } : undefined}>
        <span className="campo-etiqueta">{campo.etiqueta}</span>
        <div className="campo-calculado">{resultado || '—'}</div>
      </div>
    );
  }

  switch (campo.tipo) {
    case 'select':
      return <CampoSelect etiqueta={campo.etiqueta} valor={valor} onChange={set} opciones={campo.opciones ?? []} obligatorio={campo.obligatorio} ancho={campo.ancho} />;
    case 'sino':
      return <CampoSiNo etiqueta={campo.etiqueta} valor={valor} onChange={set} obligatorio={campo.obligatorio} ancho={campo.ancho} />;
    case 'numero':
      return <CampoNumero etiqueta={campo.etiqueta} valor={valor} onChange={set} obligatorio={campo.obligatorio} ancho={campo.ancho} />;
    case 'textarea':
      return <CampoTextoLargo etiqueta={campo.etiqueta} valor={valor} onChange={set} ancho={campo.ancho} />;
    case 'fecha':
      return <CampoTexto etiqueta={campo.etiqueta} valor={valor} onChange={set} tipo="date" obligatorio={campo.obligatorio} ancho={campo.ancho} />;
    case 'email':
      return <CampoTexto etiqueta={campo.etiqueta} valor={valor} onChange={set} tipo="email" obligatorio={campo.obligatorio} ancho={campo.ancho} />;
    case 'tel':
      return <CampoTexto etiqueta={campo.etiqueta} valor={valor} onChange={set} tipo="tel" obligatorio={campo.obligatorio} ancho={campo.ancho} />;
    default:
      return <CampoTexto etiqueta={campo.etiqueta} valor={valor} onChange={set} obligatorio={campo.obligatorio} ancho={campo.ancho} />;
  }
}
