// QR del productor: se arma con los datos de su encuesta de línea base marcados como
// "Dato del productor (QR)" y lo lee la app en las visitas. Se genera aquí, en el
// navegador: los datos no pasan por ningún servicio externo.

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, Printer } from 'lucide-react';
import { armarQR, leerQR, type Esquema, type Valores } from '@geoorigen/motor';

/** Imagen para compartir o imprimir: el QR con el nombre y la finca debajo */
async function dibujar(canvas: HTMLCanvasElement, texto: string, lineas: string[]) {
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, texto, { errorCorrectionLevel: 'M', margin: 2, width: 600 });
  const alto = qr.height + 30 + lineas.length * 44;
  canvas.width = qr.width;
  canvas.height = alto;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, alto);
  ctx.drawImage(qr, 0, 0);
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  lineas.forEach((l, i) => {
    ctx.font = `${i === 0 ? 'bold 34px' : '28px'} system-ui, sans-serif`;
    ctx.fillText(l, canvas.width / 2, qr.height + 20 + i * 44, canvas.width - 40);
  });
}

export function QRProductor({ esquema, datos, orgId, registroId, onCerrar }: {
  esquema: Esquema; datos: Valores; orgId: string; registroId: string; onCerrar: () => void;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const texto = armarQR(esquema, datos, orgId, registroId);
  const d = texto ? leerQR(texto)!.d : {};
  const lineas = [d.nombre, d.finca && `Finca ${d.finca}`, d.cedula && `C.C. ${d.cedula}`]
    .filter((x): x is string => typeof x === 'string' && !!x);
  const archivo = `QR ${[d.nombre, d.finca].filter(Boolean).join(' - ') || registroId.slice(0, 8)}.png`;

  useEffect(() => {
    if (texto && lienzo.current) dibujar(lienzo.current, texto, lineas).catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const descargar = () => {
    const a = document.createElement('a');
    a.href = lienzo.current!.toDataURL('image/png');
    a.download = archivo;
    a.click();
  };

  const imprimir = () => {
    const v = window.open('', '_blank');
    if (!v) return;
    const img = v.document.createElement('img');
    img.src = lienzo.current!.toDataURL('image/png');
    img.style.width = '8cm';
    v.document.title = archivo;
    v.document.body.style.cssText = 'margin:0;display:flex;justify-content:center;padding-top:1cm';
    v.document.body.appendChild(img);
    img.onload = () => { v.print(); };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCerrar}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">QR del productor</h2>
          <button className="btn-icon" onClick={onCerrar}><X className="h-4 w-4" /></button>
        </div>
        {!texto ? (
          <p className="text-sm text-gray-600">
            Esta encuesta no tiene datos para el QR. En el editor del formulario, marca en cada pregunta
            (cédula, nombre, finca, ubicación…) el «Dato del productor (QR)» y vuelve a publicarlo.
          </p>
        ) : (
          <>
            <canvas ref={lienzo} className="w-full rounded-lg border border-gray-100" />
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
            {!d.ubicacion && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Esta encuesta no tiene la ubicación de la finca: el QR no la llevará.
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Contiene: {Object.keys(d).map((k) => (k === 'ubicacion' ? 'ubicación' : k === 'cedula' ? 'cédula' : k)).join(', ')}.
              Se puede imprimir o enviar como foto: la app lo lee también desde la pantalla de otro celular.
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={descargar}><Download className="h-4 w-4" /> Descargar</button>
              <button className="btn-primary flex-1" onClick={imprimir}><Printer className="h-4 w-4" /> Imprimir</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
