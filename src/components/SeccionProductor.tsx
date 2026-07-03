import type { Encuesta } from '../types';
import { CampoTexto, CampoSelect, CampoNumero, CampoSiNo } from './Campos';
import {
  TIPOS_DNI, ESCOLARIDAD, SEXO, ESTADO_CIVIL,
  UNIDAD_PROD, FUENTE_AGUA, ACCESO_VIAL, SECADO,
} from '../opciones';

export function SeccionProductor({ e, set }: { e: Encuesta; set: (k: keyof Encuesta, v: string) => void }) {
  return (
    <div className="grid-campos">
      <CampoSelect etiqueta="Tipo de documento" valor={e.tipo_dni} onChange={(v) => set('tipo_dni', v)} opciones={TIPOS_DNI} obligatorio />
      <CampoTexto etiqueta="Número de documento" valor={e.dni} onChange={(v) => set('dni', v)} obligatorio />
      <CampoTexto etiqueta="Nombre completo" valor={e.nombre} onChange={(v) => set('nombre', v)} obligatorio ancho="completo" />
      <CampoTexto etiqueta="Teléfono" valor={e.telefono} onChange={(v) => set('telefono', v)} tipo="tel" />
      <CampoSelect etiqueta="Escolaridad" valor={e.escolaridad} onChange={(v) => set('escolaridad', v)} opciones={ESCOLARIDAD} />
      <CampoTexto etiqueta="Fecha de nacimiento" valor={e.fecha_nac} onChange={(v) => set('fecha_nac', v)} tipo="date" />
      <CampoSelect etiqueta="Sexo" valor={e.sexo} onChange={(v) => set('sexo', v)} opciones={SEXO} />
      <CampoSelect etiqueta="Estado civil" valor={e.estado_civil} onChange={(v) => set('estado_civil', v)} opciones={ESTADO_CIVIL} />
    </div>
  );
}

export function SeccionFinca({ e, set, capturarGPS }: {
  e: Encuesta; set: (k: keyof Encuesta, v: string) => void; capturarGPS: () => void;
}) {
  return (
    <div className="grid-campos">
      <CampoTexto etiqueta="Nombre de la finca" valor={e.finca} onChange={(v) => set('finca', v)} obligatorio ancho="completo" />
      <CampoTexto etiqueta="Departamento" valor={e.depto} onChange={(v) => set('depto', v)} />
      <CampoTexto etiqueta="Municipio" valor={e.municipio} onChange={(v) => set('municipio', v)} />
      <CampoNumero etiqueta="Altitud (msnm)" valor={e.altitud_msnm} onChange={(v) => set('altitud_msnm', v)} />

      <div className="campo ancho-completo campo-gps">
        <button type="button" className="btn-secundario" onClick={capturarGPS}>
          📍 Capturar ubicación GPS
        </button>
        <div className="gps-lectura">
          <span>Lat: {e.latitud || '—'}</span>
          <span>Lon: {e.longitud || '—'}</span>
        </div>
      </div>

      <CampoNumero etiqueta="Área total (ha)" valor={e.area_total_ha} onChange={(v) => set('area_total_ha', v)} />
      <CampoNumero etiqueta="Área en café (ha)" valor={e.area_cafe_ha} onChange={(v) => set('area_cafe_ha', v)} />
      <CampoNumero etiqueta="Área productiva (ha)" valor={e.area_prod_ha} onChange={(v) => set('area_prod_ha', v)} />
      <CampoNumero etiqueta="Área en levante (ha)" valor={e.area_levante_ha} onChange={(v) => set('area_levante_ha', v)} />
      <CampoNumero etiqueta="Área en bosque (ha)" valor={e.area_bosque_ha} onChange={(v) => set('area_bosque_ha', v)} />
      <CampoNumero etiqueta="Otros cultivos (ha)" valor={e.otros_cultivos_ha} onChange={(v) => set('otros_cultivos_ha', v)} />
      <CampoNumero etiqueta="Pastos (ha)" valor={e.pastos_ha} onChange={(v) => set('pastos_ha', v)} />
      <CampoNumero etiqueta="En renovación (ha)" valor={e.renovacion_ha} onChange={(v) => set('renovacion_ha', v)} />

      <CampoNumero etiqueta="Producción anual" valor={e.produccion_anual} onChange={(v) => set('produccion_anual', v)} />
      <CampoSelect etiqueta="Unidad de producción" valor={e.unidad_prod} onChange={(v) => set('unidad_prod', v)} opciones={UNIDAD_PROD} />

      <CampoSelect etiqueta="Fuente de agua" valor={e.fuente_agua} onChange={(v) => set('fuente_agua', v)} opciones={FUENTE_AGUA} />
      <CampoSiNo etiqueta="¿Trata las mieles/aguas?" valor={e.trat_mieles_sn} onChange={(v) => set('trat_mieles_sn', v)} />
      <CampoTexto etiqueta="Tipo de tratamiento" valor={e.tipo_tratamiento} onChange={(v) => set('tipo_tratamiento', v)} />
      <CampoSiNo etiqueta="¿Tiene fosa de pulpa?" valor={e.fosa_pulpa} onChange={(v) => set('fosa_pulpa', v)} />
      <CampoSiNo etiqueta="¿Tiene análisis de suelos?" valor={e.analisis_suelos} onChange={(v) => set('analisis_suelos', v)} />
      <CampoNumero etiqueta="Año del análisis" valor={e.ano_analisis} onChange={(v) => set('ano_analisis', v)} />
      <CampoSelect etiqueta="Acceso vial" valor={e.acceso_vial} onChange={(v) => set('acceso_vial', v)} opciones={ACCESO_VIAL} />
    </div>
  );
}

export function SeccionInfraestructura({ e, set }: { e: Encuesta; set: (k: keyof Encuesta, v: string) => void }) {
  return (
    <div className="grid-campos">
      <CampoSiNo etiqueta="Beneficiadero" valor={e.beneficiadero} onChange={(v) => set('beneficiadero', v)} />
      <CampoSiNo etiqueta="Despulpadora" valor={e.despulpadora} onChange={(v) => set('despulpadora', v)} />
      <CampoSiNo etiqueta="Fermentación" valor={e.fermentacion} onChange={(v) => set('fermentacion', v)} />
      <CampoSelect etiqueta="Secado" valor={e.secado} onChange={(v) => set('secado', v)} opciones={SECADO} />
      <CampoSiNo etiqueta="Bodega" valor={e.bodega} onChange={(v) => set('bodega', v)} />
      <CampoSiNo etiqueta="Energía eléctrica" valor={e.energia} onChange={(v) => set('energia', v)} />
      <CampoSiNo etiqueta="Internet" valor={e.internet} onChange={(v) => set('internet', v)} />
      <CampoSiNo etiqueta="Señal celular" valor={e.red_celular} onChange={(v) => set('red_celular', v)} />
      <CampoTexto etiqueta="Operador" valor={e.operador} onChange={(v) => set('operador', v)} />
    </div>
  );
}
