import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (b64: string) => void;
  disabled?: boolean;
}

function Canvas({
  canvasRef, onStart, onMove, onEnd, disabled,
  width, height, style,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onStart: (e: React.TouchEvent | React.MouseEvent) => void;
  onMove:  (e: React.TouchEvent | React.MouseEvent) => void;
  onEnd:   () => void;
  disabled?: boolean;
  width: number; height: number;
  style?: React.CSSProperties;
}) {
  return (
    <canvas
      ref={canvasRef}
      width={width} height={height}
      style={{ display: 'block', cursor: disabled ? 'default' : 'crosshair', touchAction: 'none', ...style }}
      onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
      onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
    />
  );
}

export function SignatureCanvas({ value, onChange, disabled }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const modalRef     = useRef<HTMLCanvasElement>(null);
  const drawing      = useRef(false);
  const activeCanvas = useRef<HTMLCanvasElement | null>(null);
  const [tiene,      setTiene]    = useState(!!value);
  const [expandido,  setExpand]   = useState(false);

  function cargarImagen(canvas: HTMLCanvasElement, src: string) {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = src;
  }

  // Cargar valor guardado en canvas pequeño
  useEffect(() => {
    if (value && canvasRef.current) cargarImagen(canvasRef.current, value);
  }, []);

  // Al abrir modal, copiar contenido actual al canvas grande
  useEffect(() => {
    if (expandido && modalRef.current) {
      if (value) cargarImagen(modalRef.current, value);
      // Intentar orientación landscape (no siempre disponible)
      try { (screen.orientation as any).lock?.('landscape'); } catch {}
    } else {
      try { (screen.orientation as any).unlock?.(); } catch {}
    }
  }, [expandido]);

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top)  * scaleY,
    };
  }

  const startDraw = useCallback((ref: React.RefObject<HTMLCanvasElement>) =>
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled || !ref.current) return;
      e.preventDefault();
      drawing.current = true;
      activeCanvas.current = ref.current;
      const ctx = ref.current.getContext('2d')!;
      const pos = getPos(e, ref.current);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }, [disabled]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing.current || !activeCanvas.current) return;
    e.preventDefault();
    const canvas = activeCanvas.current;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineTo(...Object.values(getPos(e, canvas)) as [number, number]);
    ctx.stroke();
  }, []);

  const stopDraw = useCallback((fromModal = false) => () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = activeCanvas.current;
    if (!canvas) return;
    const b64 = canvas.toDataURL('image/png');
    setTiene(true);
    onChange(b64);
    // Sincronizar el otro canvas
    if (fromModal && canvasRef.current) cargarImagen(canvasRef.current, b64);
    if (!fromModal && expandido && modalRef.current) cargarImagen(modalRef.current, b64);
  }, [expandido, onChange]);

  function limpiar(ref: React.RefObject<HTMLCanvasElement>) {
    if (!ref.current) return;
    ref.current.getContext('2d')!.clearRect(0, 0, ref.current.width, ref.current.height);
    if (canvasRef.current)  canvasRef.current.getContext('2d')!.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (modalRef.current)   modalRef.current.getContext('2d')!.clearRect(0, 0, modalRef.current.width, modalRef.current.height);
    setTiene(false);
    onChange('');
  }

  function cerrarModal() {
    setExpand(false);
    try { (screen.orientation as any).unlock?.(); } catch {}
  }

  return (
    <>
      {/* Canvas pequeño inline */}
      <div style={{ border: '1.5px solid #d1d5db', borderRadius: '10px', background: '#fff', overflow: 'hidden' }}>
        <Canvas
          canvasRef={canvasRef}
          onStart={startDraw(canvasRef)}
          onMove={draw}
          onEnd={stopDraw(false)}
          disabled={disabled}
          width={600} height={180}
          style={{ width: '100%', height: '130px' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
          {tiene ? 'Firma capturada' : 'Firma con tu dedo'}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!disabled && tiene && (
            <button type="button" onClick={() => limpiar(canvasRef)}
              style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
              Borrar
            </button>
          )}
          {!disabled && (
            <button type="button" onClick={() => setExpand(true)}
              style={{ fontSize: '0.75rem', color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              ⛶ Ampliar
            </button>
          )}
        </div>
      </div>

      {/* Modal pantalla completa */}
      {expandido && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: '#fff', display: 'flex', flexDirection: 'column',
        }}>
          {/* Barra superior */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff',
          }}>
            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>✍ Firma</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              {tiene && (
                <button type="button" onClick={() => limpiar(modalRef)}
                  style={{ fontSize: '0.8rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Borrar
                </button>
              )}
              <button type="button" onClick={cerrarModal}
                style={{
                  fontSize: '0.8rem', fontWeight: 600, color: '#fff',
                  background: '#0F6E56', border: 'none', borderRadius: '8px',
                  padding: '6px 14px', cursor: 'pointer',
                }}>
                Guardar y cerrar
              </button>
            </div>
          </div>
          {/* Canvas grande */}
          <div style={{ flex: 1, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1.5px solid #d1d5db', width: '100%', height: '100%', overflow: 'hidden' }}>
              <Canvas
                canvasRef={modalRef}
                onStart={startDraw(modalRef)}
                onMove={draw}
                onEnd={stopDraw(true)}
                disabled={disabled}
                width={1200} height={600}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#9ca3af', padding: '8px' }}>
            Gira el teléfono horizontalmente para más espacio
          </p>
        </div>
      )}
    </>
  );
}
