// Lector de QR en pantalla completa. Funciona sin internet: lee el código con la
// cámara (también desde la pantalla de otro celular) o desde una foto guardada.

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { X, ImagePlus } from 'lucide-react';

/** Lee un QR de una imagen ya dibujada; reduce su tamaño para que sea rápido */
function leerDe(fuente: CanvasImageSource, ancho: number, alto: number, lienzo: HTMLCanvasElement): string | null {
  const escala = Math.min(1, 800 / Math.max(ancho, alto));
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
  const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

export function EscanerQR({ onLeido, onCerrar }: { onLeido: (texto: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const [aviso, setAviso] = useState('Apunta la cámara al código QR');

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let activo = true;
    let cuadro: ReturnType<typeof setTimeout> | undefined;
    const buscar = () => {
      const v = video.current;
      if (!activo || !v) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const texto = leerDe(v, v.videoWidth, v.videoHeight, lienzo.current);
        if (texto) { activo = false; onLeido(texto); return; }
      }
      // Unas 7 lecturas por segundo: suficiente y gasta menos batería que cada cuadro
      cuadro = setTimeout(buscar, 150);
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (!activo) { s.getTracks().forEach((t) => t.stop()); return; }
        flujo = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        buscar();
      })
      .catch(() => setAviso('No se pudo abrir la cámara. Revisa el permiso de cámara, o lee el QR desde una foto.'));
    return () => {
      activo = false;
      clearTimeout(cuadro);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, [onLeido]);

  // Desde una foto (por ejemplo, la que mandaron por WhatsApp)
  const desdeFoto = async () => {
    let foto;
    try {
      foto = await Camera.getPhoto({ source: CameraSource.Photos, resultType: CameraResultType.DataUrl, quality: 90, webUseInput: true });
    } catch {
      return;  // canceló
    }
    if (!foto.dataUrl) return;
    const img = new Image();
    // onload y no img.decode(): decode puede quedarse esperando si la app no está en pantalla
    const cargada = await new Promise<boolean>((ok) => { img.onload = () => ok(true); img.onerror = () => ok(false); img.src = foto.dataUrl!; });
    if (!cargada) { setAviso('No se pudo abrir esa foto.'); return; }
    const texto = leerDe(img, img.naturalWidth, img.naturalHeight, lienzo.current);
    if (texto) onLeido(texto);
    else setAviso('No se encontró un QR en esa foto. Prueba con otra más nítida.');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Escanear QR del productor</span>
        <button onClick={onCerrar} className="rounded-lg p-1 active:bg-white/20" aria-label="Cerrar"><X className="h-6 w-6" /></button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white/80" />
      </div>
      <div className="space-y-3 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <p className="text-center text-sm opacity-90">{aviso}</p>
        <button onClick={desdeFoto} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-3 font-medium active:bg-white/25">
          <ImagePlus className="h-5 w-5" /> Leer desde una foto
        </button>
      </div>
    </div>
  );
}
