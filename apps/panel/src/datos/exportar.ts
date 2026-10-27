// Exporta exactamente lo que está filtrado en pantalla.

import type { Esquema, Fila } from '@geoorigen/motor';
import { ALERTAS, camposConValor, tituloRegistro, valorComoTexto, type RegistroPanel } from './registros.ts';

type Celda = string | number | null;

/** Tabla plana: una fila por registro; los grupos repetibles se abren en columnas (Lotes 1 · Área…) */
export function tablaPlana(filas: RegistroPanel[], esquema: Esquema, conControl: boolean): { encabezados: string[]; datos: Celda[][] } {
  const campos = camposConValor(esquema);
  const encabezados = [
    'ID', 'Estado', 'Técnico', 'Inició', 'Recibido', 'Versión',
    'Lat. captura', 'Lon. captura', 'Precisión GPS (m)', 'Lat. finca', 'Lon. finca',
    ...(conControl ? ['Distancia a la finca (m)', 'Duración (min)', 'Alertas'] : []),
  ];
  // Máximo de filas por repetible, para saber cuántas columnas abrir
  const maxFilas = new Map<string, number>();
  for (const c of campos) {
    if (c.tipo === 'repetible') {
      maxFilas.set(c.key, Math.max(0, ...filas.map((r) => (Array.isArray(r.datos[c.key]) ? (r.datos[c.key] as Fila[]).length : 0))));
    }
  }
  for (const c of campos) {
    if (c.tipo === 'repetible') {
      const hijos = (c.campos ?? []).filter((h) => !['separador', 'instruccion'].includes(h.tipo));
      for (let i = 1; i <= (maxFilas.get(c.key) ?? 0); i++) {
        for (const h of hijos) encabezados.push(`${c.etiquetaFila || c.etiqueta} ${i} · ${h.etiqueta}`);
      }
    } else {
      encabezados.push(c.etiqueta);
    }
  }

  const datos = filas.map((r) => {
    const fila: Celda[] = [
      r.id, r.estado, r.tecnico_nombre || r.tecnico_email || '',
      r.captura_inicio_en ?? r.creado_en, r.recibido_en, r.formulario_version,
      r.captura_lat, r.captura_lon, r.captura_inicio_precision != null ? Math.round(r.captura_inicio_precision) : null,
      r.finca_lat, r.finca_lon,
      ...(conControl ? [
        r.distancia_finca_m != null ? Math.round(r.distancia_finca_m) : null,
        r.duracion_s != null ? Math.round(r.duracion_s / 60) : null,
        r.alertas.map((a) => ALERTAS[a]?.texto ?? a).join('; '),
      ] : []),
    ];
    for (const c of campos) {
      if (c.tipo === 'repetible') {
        const filasR = (Array.isArray(r.datos[c.key]) ? r.datos[c.key] : []) as Fila[];
        const hijos = (c.campos ?? []).filter((h) => !['separador', 'instruccion'].includes(h.tipo));
        for (let i = 0; i < (maxFilas.get(c.key) ?? 0); i++) {
          for (const h of hijos) fila.push(filasR[i] ? valorComoTexto(h, filasR[i][h.key]) : '');
        }
      } else {
        const t = valorComoTexto(c, r.datos[c.key]);
        // Números como número, para que Excel pueda sumarlos
        fila.push(['numero', 'decimal', 'calculado'].includes(c.tipo) && t !== '' && !Number.isNaN(Number(t)) ? Number(t) : t);
      }
    }
    return fila;
  });
  return { encabezados, datos };
}

function descargar(contenido: BlobPart, tipo: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const base = (nombreForm: string) =>
  `${nombreForm.replace(/[^\p{L}\p{N}]+/gu, '_')}_${new Date().toISOString().slice(0, 10)}`;

export async function exportarExcel(filas: RegistroPanel[], esquema: Esquema, nombreForm: string, conControl: boolean) {
  const XLSX = await import('xlsx');  // se carga solo al exportar
  const { encabezados, datos } = tablaPlana(filas, esquema, conControl);
  const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...datos]);
  hoja['!cols'] = encabezados.map((e) => ({ wch: Math.min(40, Math.max(10, e.length + 2)) }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Registros');
  XLSX.writeFile(libro, `${base(nombreForm)}.xlsx`);
}

export function exportarCSV(filas: RegistroPanel[], esquema: Esquema, nombreForm: string, conControl: boolean) {
  const { encabezados, datos } = tablaPlana(filas, esquema, conControl);
  const celda = (v: Celda) => {
    const t = v == null ? '' : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // Punto y coma y BOM: así lo abre bien Excel en español
  const csv = '﻿' + [encabezados, ...datos].map((f) => f.map(celda).join(';')).join('\r\n');
  descargar(csv, 'text/csv;charset=utf-8', `${base(nombreForm)}.csv`);
}

export function exportarGeoJSON(filas: RegistroPanel[], esquema: Esquema, nombreForm: string) {
  const features = filas.flatMap((r) => {
    const { titulo } = tituloRegistro(r, esquema);
    const props = { id: r.id, titulo, estado: r.estado, tecnico: r.tecnico_nombre || r.tecnico_email, fecha: r.captura_inicio_en ?? r.creado_en };
    const salida = [];
    if (r.captura_lat != null) salida.push({ type: 'Feature', properties: { ...props, punto: 'captura' }, geometry: { type: 'Point', coordinates: [r.captura_lon, r.captura_lat] } });
    if (r.finca_lat != null) salida.push({ type: 'Feature', properties: { ...props, punto: 'finca' }, geometry: { type: 'Point', coordinates: [r.finca_lon, r.finca_lat] } });
    return salida;
  });
  descargar(JSON.stringify({ type: 'FeatureCollection', features }, null, 1), 'application/geo+json', `${base(nombreForm)}.geojson`);
}

export function exportarKML(filas: RegistroPanel[], esquema: Esquema, nombreForm: string) {
  const x = (t: string) => t.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
  const marca = (r: RegistroPanel, lat: number, lon: number, estilo: string) => {
    const { titulo } = tituloRegistro(r, esquema);
    return `<Placemark><name>${x(titulo)}</name><styleUrl>#${estilo}</styleUrl>
<description>${x(`${r.estado} · ${r.tecnico_nombre || r.tecnico_email || ''} · ${r.captura_inicio_en ?? r.creado_en}`)}</description>
<Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`;
  };
  const capturas = filas.filter((r) => r.captura_lat != null).map((r) => marca(r, r.captura_lat!, r.captura_lon!, 'captura'));
  const fincas = filas.filter((r) => r.finca_lat != null).map((r) => marca(r, r.finca_lat!, r.finca_lon!, 'finca'));
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(nombreForm)}</name>
<Style id="captura"><IconStyle><color>ff7f3f00</color></IconStyle></Style>
<Style id="finca"><IconStyle><color>ff888888</color><scale>0.8</scale></IconStyle></Style>
<Folder><name>Dónde se hizo la encuesta</name>${capturas.join('\n')}</Folder>
<Folder><name>Ubicación de la finca</name>${fincas.join('\n')}</Folder>
</Document></kml>`;
  descargar(kml, 'application/vnd.google-earth.kml+xml', `${base(nombreForm)}.kml`);
}
