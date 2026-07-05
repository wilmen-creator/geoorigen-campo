import type { FormularioDinamico } from '../generico/tipos';
import type { LineaSync } from '../App';
import type { PerfilColaborador } from '../sync';
import { esquemaCacao } from '../generico/schema-cacao';

export function Inicio({
  onCafe, onCacao, onAjustes, conteoCafe, conteoCacao,
  formularios, onFormulario,
  onSincronizar, sincronizando, syncLineas,
  enLinea, sesionEmail, perfil,
}: {
  onCafe: () => void;
  onCacao: () => void;
  onAjustes: () => void;
  conteoCafe: number;
  conteoCacao: number;
  formularios: FormularioDinamico[];
  onFormulario: (f: FormularioDinamico) => void;
  onSincronizar: () => void;
  sincronizando: boolean;
  syncLineas: LineaSync[];
  enLinea: boolean;
  sesionEmail: string | null;
  perfil: PerfilColaborador | null;
}) {
  return (
    <div className="lista-contenedor">
      <header className="app-header">
        <div>
          <h1>GeoOrigen Campo</h1>
          <p className="subtitulo">
            {sesionEmail ? sesionEmail : 'Sin sesión iniciada'}
          </p>
        </div>
        <button className="btn-ajustes" onClick={onAjustes} aria-label="Ajustes">⚙</button>
      </header>

      {/* Aviso sin sesión */}
      {!sesionEmail && (
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa',
          borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: '#92400e', fontSize: '0.875rem', marginBottom: '2px' }}>
              No has iniciado sesión
            </p>
            <p style={{ color: '#b45309', fontSize: '0.75rem' }}>
              Necesitas sesión para sincronizar datos.
            </p>
          </div>
          <button className="btn-secundario" onClick={onAjustes}
            style={{ fontSize: '0.75rem', padding: '4px 10px', whiteSpace: 'nowrap' }}>
            Iniciar sesión
          </button>
        </div>
      )}

      {/* Botón principal de sincronización */}
      <button
        className={sincronizando ? 'btn-secundario' : 'btn-primario'}
        onClick={onSincronizar}
        disabled={sincronizando || !enLinea || !sesionEmail}
        style={{ width: '100%', marginBottom: '12px', fontSize: '1rem', padding: '14px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
      >
        {sincronizando ? (
          <>
            <span style={{ display: 'inline-block', width: '18px', height: '18px', border: '3px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Sincronizando...
          </>
        ) : (
          <>
            <span style={{ fontSize: '1.25rem' }}>🔄</span>
            {enLinea ? 'Sincronizar todo' : 'Sin conexión'}
          </>
        )}
      </button>

      {/* Resultados de la última sincronización */}
      {syncLineas.length > 0 && !sincronizando && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '12px', padding: '12px 14px', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534', marginBottom: '8px' }}>
            Última sincronización ✓
          </p>
          {syncLineas.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.875rem', width: '20px', textAlign: 'center' }}>{l.icono}</span>
              <span style={{ fontSize: '0.75rem', color: '#15803d', flex: 1 }}>
                {l.nombre}
              </span>
              <span style={{ fontSize: '0.75rem', color: l.ok ? '#166534' : '#dc2626', fontWeight: 500 }}>
                {l.ok
                  ? l.subidas > 0 ? `↑ ${l.subidas}` : '✓'
                  : '✗ error'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tarjetas de módulos */}
      <div className="tarjetas-inicio">
        {/* perfil null = admin → acceso total; perfil.acceso_cafe = true → mostrar */}
        {(perfil === null || perfil.acceso_cafe) && (
          <button className="tarjeta-modulo" onClick={onCafe}>
            <span className="tarjeta-modulo-icono">☕</span>
            <span className="tarjeta-modulo-nombre">Línea Base Café</span>
            <span className="tarjeta-modulo-conteo">{conteoCafe} registro(s)</span>
          </button>
        )}

        {(perfil === null || perfil.acceso_cacao) && (
          <button className="tarjeta-modulo" onClick={onCacao}>
            <span className="tarjeta-modulo-icono">{esquemaCacao.icono}</span>
            <span className="tarjeta-modulo-nombre">{esquemaCacao.nombre}</span>
            <span className="tarjeta-modulo-conteo">{conteoCacao} registro(s)</span>
          </button>
        )}

        {formularios.map((f) => (
          <button key={f.id} className="tarjeta-modulo" onClick={() => onFormulario(f)}>
            <span className="tarjeta-modulo-icono">{f.icono || '📋'}</span>
            <span className="tarjeta-modulo-nombre">{f.nombre}</span>
            <span className="tarjeta-modulo-conteo">v{f.version}</span>
          </button>
        ))}
      </div>

      {formularios.length === 0 && sesionEmail && enLinea && !sincronizando && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', marginTop: '16px' }}>
          Sincroniza para ver los formularios asignados
        </p>
      )}
    </div>
  );
}
