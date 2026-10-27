import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

interface Props {
  value: string[];     // array de URLs o base64 pendientes de subir
  onChange: (fotos: string[]) => void;
  disabled?: boolean;
  maxFotos?: number;
}

export function PhotoCapture({ value = [], onChange, disabled, maxFotos = 5 }: Props) {

  async function tomarFoto(source: CameraSource) {
    try {
      const photo = await Camera.getPhoto({
        quality: 70,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source,
        width: 1280,
      });
      if (photo.dataUrl) {
        onChange([...value, photo.dataUrl]);
      }
    } catch (e: any) {
      if (!e?.message?.includes('cancelled') && !e?.message?.includes('cancel')) {
        alert('Error al acceder a la cámara: ' + e?.message);
      }
    }
  }

  function eliminar(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  const puedaAgregar = !disabled && value.length < maxFotos;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Miniaturas */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {value.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
              <img
                src={src}
                alt={`Foto ${i + 1}`}
                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => eliminar(i)}
                  style={{
                    position: 'absolute', top: '-6px', right: '-6px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#dc2626', color: '#fff', border: 'none',
                    fontSize: '12px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>
                  ×
                </button>
              )}
              {/* Indicador: pendiente de subir */}
              {src.startsWith('data:') && (
                <span style={{
                  position: 'absolute', bottom: '2px', left: '2px',
                  background: 'rgba(0,0,0,0.55)', borderRadius: '4px',
                  fontSize: '9px', color: '#fbbf24', padding: '1px 4px',
                }}>
                  pendiente
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botones de captura */}
      {puedaAgregar && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => tomarFoto(CameraSource.Camera)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: '1.5px dashed #d1d5db', background: '#f9fafb',
              fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
            📷 Cámara
          </button>
          <button
            type="button"
            onClick={() => tomarFoto(CameraSource.Photos)}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: '1.5px dashed #d1d5db', background: '#f9fafb',
              fontSize: '0.8rem', color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
            🖼 Galería
          </button>
        </div>
      )}
      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
        {value.length}/{maxFotos} foto{maxFotos !== 1 ? 's' : ''}
        {value.some(s => s.startsWith('data:')) ? ' · Se subirán al sincronizar' : ''}
      </span>
    </div>
  );
}
