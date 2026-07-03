import type { ChangeEvent } from 'react';

interface PropsBase {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  obligatorio?: boolean;
  ancho?: 'completo' | 'medio';
}

const envoltura = (ancho?: string) => ({
  gridColumn: ancho === 'completo' ? '1 / -1' : undefined,
});

export function CampoTexto({ etiqueta, valor, onChange, obligatorio, ancho, tipo = 'text' }: PropsBase & { tipo?: string }) {
  return (
    <label className="campo" style={envoltura(ancho)}>
      <span className="campo-etiqueta">{etiqueta}{obligatorio && <em>*</em>}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        required={obligatorio}
      />
    </label>
  );
}

export function CampoNumero({ etiqueta, valor, onChange, obligatorio, ancho }: PropsBase) {
  const manejarCambio = (v: string) => {
    onChange(v.replace('-', ''));
  };
  return (
    <label className="campo" style={envoltura(ancho)}>
      <span className="campo-etiqueta">{etiqueta}{obligatorio && <em>*</em>}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        value={valor}
        onChange={(e: ChangeEvent<HTMLInputElement>) => manejarCambio(e.target.value)}
        onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
        required={obligatorio}
      />
    </label>
  );
}

export function CampoTextoLargo({ etiqueta, valor, onChange, ancho }: PropsBase) {
  return (
    <label className="campo" style={envoltura(ancho ?? 'completo')}>
      <span className="campo-etiqueta">{etiqueta}</span>
      <textarea rows={3} value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function CampoSelect({
  etiqueta, valor, onChange, opciones, obligatorio, ancho,
}: PropsBase & { opciones: string[] }) {
  return (
    <label className="campo" style={envoltura(ancho)}>
      <span className="campo-etiqueta">{etiqueta}{obligatorio && <em>*</em>}</span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} required={obligatorio}>
        <option value="">Seleccionar...</option>
        {opciones.map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
    </label>
  );
}

export function CampoSiNo(props: PropsBase) {
  return <CampoSelect {...props} opciones={['Si', 'No']} />;
}
