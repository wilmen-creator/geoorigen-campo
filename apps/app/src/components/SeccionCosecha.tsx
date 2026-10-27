import type { Encuesta } from '../types';
import { CampoTexto, CampoSelect, CampoNumero, CampoSiNo, CampoTextoLargo } from './Campos';
import { TIPO_PROCESO } from '../opciones';

export function SeccionCosecha({ e, set }: { e: Encuesta; set: (k: keyof Encuesta, v: string) => void }) {
  return (
    <div className="grid-campos">
      <CampoTexto etiqueta="Cosecha principal (meses)" valor={e.cosecha_ppal} onChange={(v) => set('cosecha_ppal', v)} />
      <CampoTexto etiqueta="Mitaca (meses)" valor={e.mitaca} onChange={(v) => set('mitaca', v)} />
      <CampoTextoLargo etiqueta="Detalle de meses de cosecha" valor={e.meses_detalle} onChange={(v) => set('meses_detalle', v)} />
      <CampoNumero etiqueta="Horas de fermentación" valor={e.ferm_horas} onChange={(v) => set('ferm_horas', v)} />
      <CampoSiNo etiqueta="¿Lavado?" valor={e.lavado} onChange={(v) => set('lavado', v)} />
      <CampoSiNo etiqueta="¿Procesos especiales?" valor={e.proc_especiales} onChange={(v) => set('proc_especiales', v)} />
      <CampoSelect etiqueta="Tipo de proceso" valor={e.tipo_proceso} onChange={(v) => set('tipo_proceso', v)} opciones={TIPO_PROCESO} />
      <CampoTexto etiqueta="¿Cuál proceso?" valor={e.cual_proceso} onChange={(v) => set('cual_proceso', v)} />
      <CampoTextoLargo etiqueta="Observaciones de cosecha" valor={e.obs_cosecha} onChange={(v) => set('obs_cosecha', v)} />
    </div>
  );
}

export function SeccionCalidad({ e, set }: { e: Encuesta; set: (k: keyof Encuesta, v: string) => void }) {
  return (
    <div className="grid-campos">
      <CampoSiNo etiqueta="¿Certificaciones?" valor={e.certificaciones} onChange={(v) => set('certificaciones', v)} />
      <CampoTexto etiqueta="Tipo de certificación" valor={e.tipo_certif} onChange={(v) => set('tipo_certif', v)} />
      <CampoTexto etiqueta="¿Cuál certificación?" valor={e.cual_certif} onChange={(v) => set('cual_certif', v)} />
      <CampoSiNo etiqueta="¿Ha participado en concursos?" valor={e.concursos} onChange={(v) => set('concursos', v)} />
      <CampoTexto etiqueta="Nombre del concurso" valor={e.nombre_concurso} onChange={(v) => set('nombre_concurso', v)} />
      <CampoSiNo etiqueta="¿Conoce su puntaje de taza?" valor={e.conoce_puntaje} onChange={(v) => set('conoce_puntaje', v)} />
      <CampoNumero etiqueta="Puntaje de taza" valor={e.puntaje_taza} onChange={(v) => set('puntaje_taza', v)} />
      <CampoSiNo etiqueta="¿Recibe primas?" valor={e.primas} onChange={(v) => set('primas', v)} />
      <CampoTexto etiqueta="Comprador" valor={e.comprador} onChange={(v) => set('comprador', v)} />
      <CampoNumero etiqueta="Precio (COP)" valor={e.precio_cop} onChange={(v) => set('precio_cop', v)} />
      <CampoTextoLargo etiqueta="Observaciones de calidad" valor={e.obs_calidad} onChange={(v) => set('obs_calidad', v)} />
    </div>
  );
}
