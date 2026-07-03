// Sistema genérico de formularios por esquema — usado por Cacao y futuros
// registros, sin tocar el código específico de Café (que ya funciona).

export type TipoCampo =
  | 'texto' | 'numero' | 'select' | 'sino'
  | 'fecha' | 'textarea' | 'email' | 'tel' | 'calculado';

export interface CondicionCampo {
  key: string;
  valor: string;
}

export interface CampoSchema {
  key: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  ancho?: 'completo' | 'medio';
  obligatorio?: boolean;
  // Solo para tipo 'calculado': deriva el valor a partir de otras respuestas
  calcular?: (datos: Record<string, string>) => string;
  // Si se define, el campo solo se muestra cuando TODAS estas condiciones
  // se cumplen (ej: mostrar solo si 'pertenece_asociacion' === 'Si')
  dependeDe?: CondicionCampo[];
}

export function campoVisible(campo: CampoSchema, datos: Record<string, string>): boolean {
  if (!campo.dependeDe || campo.dependeDe.length === 0) return true;
  return campo.dependeDe.every((c) => datos[c.key] === c.valor);
}

export interface SeccionSchema {
  titulo: string;
  campos: CampoSchema[];
  // true en la sección donde debe aparecer el botón de captura GPS
  conGPS?: boolean;
}

export interface EsquemaRegistro {
  tipo: string; // identificador único, ej. 'cacao'
  nombre: string; // nombre visible, ej. 'Línea Base Cacao'
  icono: string;
  secciones: SeccionSchema[];
  // claves usadas para mostrar la tarjeta en la lista (nombre / subtítulo)
  claveNombre: string;
  claveSubtitulo: string;
}

export interface RegistroGenerico {
  id: string;
  tipo: string;
  creado_en: string;
  actualizado_en: string;
  sincronizado: boolean;
  sincronizado_en?: string;
  datos: Record<string, string>;
}

export function registroVacio(tipo: string): RegistroGenerico {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    tipo,
    creado_en: now,
    actualizado_en: now,
    sincronizado: false,
    datos: {},
  };
}
