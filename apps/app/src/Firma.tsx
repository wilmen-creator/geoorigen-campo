// Campo de firma. El recuadro de la encuesta solo MUESTRA la firma guardada: se firma
// únicamente en pantalla completa ("Firmar" o "Modificar"), y la firma solo cambia al
// tocar "Guardar". Así un toque accidental en el recuadro no la daña.

import { useRef, useEffect, useState } from 'react';

interface Props {
  value: string;
  onChange: (b64: string) => void;
  disabled?: boolean;
}

export function SignatureCanvas({ value, onChange, disabled }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [abierto, setAbierto] = useState(false);
  const [trazos, setTrazos] = useState(false);

  // Tamaño de la pantalla: con el celular vertical el área de firma se dibuja girada
  // 90°, para que se firme a lo largo y la firma quede siempre horizontal.
  const [pantalla, setPantalla] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const medir = () => setPantalla({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  const girado = pantalla.h > pantalla.w;
  // Lado largo y corto disponibles (descontando la barra superior y márgenes), proporción 2:1
  const largo = (girado ? pantalla.h : pantalla.w) - (girado ? 110 : 24);
  const corto = (girado ? pantalla.w : pantalla.h) - (girado ? 24 : 110);
  const anchoFirma = Math.max(200, Math.min(largo, corto * 2));

  // Intentar poner la pantalla horizontal mientras se firma (no siempre disponible)
  useEffect(() => {
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (abierto) o.lock?.('landscape')?.catch(() => {});
      else o.unlock?.();
    } catch { /* sin soporte */ }
  }, [abierto]);

  function posicion(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const p = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    if (girado) {
      // Girado 90° a la derecha: el eje x del lienzo baja por la pantalla y el y va hacia la izquierda
      return {
        x: ((p.clientY - rect.top) / rect.height) * canvas.width,
        y: ((rect.right - p.clientX) / rect.width) * canvas.height,
      };
    }
    return {
      x: ((p.clientX - rect.left) / rect.width) * canvas.width,
      y: ((p.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  const empezar = (e: React.TouchEvent | React.MouseEvent) => {
    const c = lienzo.current;
    if (!c) return;
    e.preventDefault();
    dibujando.current = true;
    const ctx = c.getContext('2d')!;
    const { x, y } = posicion(e, c);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const mover = (e: React.TouchEvent | React.MouseEvent) => {
    const c = lienzo.current;
    if (!dibujando.current || !c) return;
    e.preventDefault();
    const ctx = c.getContext('2d')!;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    const { x, y } = posicion(e, c);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const terminar = () => {
    if (!dibujando.current) return;
    dibujando.current = false;
    setTrazos(true);
  };

  const limpiar = () => {
    const c = lienzo.current;
    c?.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setTrazos(false);
  };

  // Siempre se abre en blanco: "Modificar" es firmar de nuevo
  const abrir = () => { setTrazos(false); setAbierto(true); };
  const cancelar = () => setAbierto(false);
  const guardar = () => {
    if (lienzo.current && trazos) onChange(lienzo.current.toDataURL('image/png'));
    setAbierto(false);
  };
  const borrar = () => { if (confirm('¿Borrar la firma?')) onChange(''); };

  return (
    <>
      {/* Vista de la firma guardada: no recibe trazos */}
      <div className="flex h-[130px] items-center justify-center overflow-hidden rounded-[10px] border-[1.5px] border-gray-300 bg-white">
        {value
          ? <img src={value} alt="Firma" className="h-full w-full object-contain" />
          : <span className="text-sm text-gray-400">{disabled ? 'Sin firma' : 'Toca "Firmar" para firmar'}</span>}
      </div>
      {!disabled && (
        <div className="mt-1.5 flex items-center justify-end gap-4">
          {value && <button type="button" onClick={borrar} className="text-sm text-red-600">Borrar</button>}
          <button type="button" onClick={abrir} className="text-sm font-semibold text-primary">
            ✍ {value ? 'Modificar' : 'Firmar'}
          </button>
        </div>
      )}

      {/* Pantalla completa para firmar */}
      {abierto && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5">
            <button type="button" onClick={cancelar} className="text-sm text-gray-600">Cancelar</button>
            <div className="flex items-center gap-3">
              {trazos && <button type="button" onClick={limpiar} className="text-sm text-red-600">Limpiar</button>}
              <button type="button" onClick={guardar} disabled={!trazos}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                Guardar
              </button>
            </div>
          </div>
          <div className="relative flex-1 overflow-hidden bg-gray-50">
            <div
              className="absolute top-1/2 left-1/2 overflow-hidden rounded-xl border-[1.5px] border-gray-300 bg-white"
              style={{
                width: anchoFirma, height: anchoFirma / 2,
                transform: `translate(-50%, -50%)${girado ? ' rotate(90deg)' : ''}`,
              }}>
              <canvas
                ref={lienzo}
                width={1200} height={600}
                style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
                onMouseDown={empezar} onMouseMove={mover} onMouseUp={terminar} onMouseLeave={terminar}
                onTouchStart={empezar} onTouchMove={mover} onTouchEnd={terminar}
              />
            </div>
          </div>
          <p className="p-2 text-center text-xs text-gray-400">
            {girado ? 'Gira el teléfono y firma a lo largo' : 'Firma dentro del recuadro'}
          </p>
        </div>
      )}
    </>
  );
}
