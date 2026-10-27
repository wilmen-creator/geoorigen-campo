// Mapa de encuestas: dónde estaba el celular (círculo de color por estado) y la
// ubicación declarada de la finca (cuadro gris), unidos por una línea punteada.

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Esquema } from '@geoorigen/motor';
import { tituloRegistro, type RegistroPanel } from './registros.ts';

export const COLOR_ESTADO: Record<string, string> = {
  borrador: '#9ca3af', enviado: '#3b82f6', revisado: '#f59e0b', aprobado: '#10b981', rechazado: '#ef4444',
};

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function Mapa({ filas, esquema, seleccionado, onElegir }: {
  filas: RegistroPanel[];
  esquema: Esquema | null;
  seleccionado: string | null;
  onElegir: (id: string) => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const elegir = useRef(onElegir);
  elegir.current = onElegir;

  useEffect(() => {
    if (!caja.current || mapa.current) return;
    const m = L.map(caja.current, { center: [3.53, -75.64], zoom: 11 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; colaboradores de OpenStreetMap',
    }).addTo(m);
    capa.current = L.layerGroup().addTo(m);
    mapa.current = m;
    // El contenedor puede cambiar de tamaño al alternar tabla/mapa
    const obs = new ResizeObserver(() => m.invalidateSize());
    obs.observe(caja.current);
    return () => { obs.disconnect(); m.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    const m = mapa.current, g = capa.current;
    if (!m || !g) return;
    g.clearLayers();
    const puntos: L.LatLngExpression[] = [];
    for (const r of filas) {
      const { titulo } = tituloRegistro(r, esquema);
      const color = COLOR_ESTADO[r.estado] ?? '#6b7280';
      const activo = r.id === seleccionado;
      if (r.finca_lat != null && r.finca_lon != null) {
        const finca: L.LatLngExpression = [r.finca_lat, r.finca_lon];
        L.circleMarker(finca, { radius: 4, color: '#6b7280', weight: 1, fillColor: '#ffffff', fillOpacity: 1 })
          .bindTooltip(`Finca · ${escapar(titulo)}`).on('click', () => elegir.current(r.id)).addTo(g);
        puntos.push(finca);
        if (r.captura_lat != null && r.captura_lon != null) {
          L.polyline([finca, [r.captura_lat, r.captura_lon]], {
            color: r.alertas.includes('lejos_finca') ? '#ef4444' : '#9ca3af', weight: 1.5, dashArray: '4 4',
          }).addTo(g);
        }
      }
      if (r.captura_lat != null && r.captura_lon != null) {
        const p: L.LatLngExpression = [r.captura_lat, r.captura_lon];
        L.circleMarker(p, {
          radius: activo ? 10 : 7, color: activo ? '#111827' : '#ffffff', weight: activo ? 3 : 2,
          fillColor: color, fillOpacity: 0.95,
        })
          .bindTooltip(`${escapar(titulo)}<br>${escapar(r.tecnico_nombre || r.tecnico_email || '')}${r.alertas.length ? `<br>⚠ ${r.alertas.length} alerta(s)` : ''}`)
          .on('click', () => elegir.current(r.id))
          .addTo(g);
        puntos.push(p);
      }
    }
    if (puntos.length && !seleccionado) m.fitBounds(L.latLngBounds(puntos), { padding: [30, 30], maxZoom: 15 });
  }, [filas, esquema, seleccionado]);

  // Al elegir un registro desde la tabla, el mapa va hasta él
  useEffect(() => {
    const r = filas.find((x) => x.id === seleccionado);
    if (r?.captura_lat != null && r.captura_lon != null) mapa.current?.setView([r.captura_lat, r.captura_lon], 15);
  }, [seleccionado, filas]);

  return (
    <div className="relative h-full w-full">
      <div ref={caja} className="h-full w-full" />
      <div className="absolute bottom-2 left-2 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs shadow">
        {Object.entries(COLOR_ESTADO).map(([e, c]) => (
          <span key={e} className="mr-2 inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} /> {e}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border border-gray-500 bg-white" /> finca
        </span>
      </div>
    </div>
  );
}
