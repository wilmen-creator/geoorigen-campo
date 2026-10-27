// Tipos de datos para la Encuesta de Línea Base — GeoOrigen Campo

export interface LoteData {
  nombre: string;
  variedad: string;
  var_otra: string;
  sombrio: string;
  area_lote: string;
  area_cafe: string;
  num_plant: string;
  edad: string;
  dist_calle: string;
  dist_plant: string;
  productivo: string;
}

export const loteVacio = (): LoteData => ({
  nombre: '',
  variedad: '',
  var_otra: '',
  sombrio: '',
  area_lote: '',
  area_cafe: '',
  num_plant: '',
  edad: '',
  dist_calle: '',
  dist_plant: '',
  productivo: '',
});

export interface Encuesta {
  // metadatos locales
  id: string; // uuid generado en el dispositivo
  creado_en: string;
  actualizado_en: string;
  sincronizado: boolean;
  sincronizado_en?: string;

  // PRODUCTOR
  tipo_dni: string;
  dni: string;
  nombre: string;
  telefono: string;
  direccion: string;
  escolaridad: string;
  fecha_nac: string;
  sexo: string;
  estado_civil: string;

  // FINCA
  finca: string;
  depto: string;
  municipio: string;
  altitud_msnm: string;
  latitud: string;
  longitud: string;
  area_total_ha: string;
  area_cafe_ha: string;
  area_prod_ha: string;
  area_levante_ha: string;
  area_bosque_ha: string;
  otros_cultivos_ha: string;
  pastos_ha: string;
  renovacion_ha: string;
  produccion_anual: string;
  unidad_prod: string;
  fuente_agua: string;
  trat_mieles_sn: string;
  tipo_tratamiento: string;
  fosa_pulpa: string;
  analisis_suelos: string;
  ano_analisis: string;
  acceso_vial: string;

  // INFRAESTRUCTURA
  beneficiadero: string;
  despulpadora: string;
  fermentacion: string;
  secado: string;
  bodega: string;
  energia: string;
  internet: string;
  red_celular: string;
  operador: string;

  // LOTES (dinámico, máx. 5)
  lotes: LoteData[];

  // COSECHA
  cosecha_ppal: string;
  mitaca: string;
  meses_detalle: string;
  ferm_horas: string;
  lavado: string;
  proc_especiales: string;
  tipo_proceso: string;
  cual_proceso: string;
  obs_cosecha: string;

  // CALIDAD
  certificaciones: string;
  tipo_certif: string;
  cual_certif: string;
  concursos: string;
  nombre_concurso: string;
  conoce_puntaje: string;
  puntaje_taza: string;
  primas: string;
  comprador: string;
  precio_cop: string;
  obs_calidad: string;
}

export const encuestaVacia = (): Encuesta => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    creado_en: now,
    actualizado_en: now,
    sincronizado: false,

    tipo_dni: '', dni: '', nombre: '', telefono: '', direccion: '',
    escolaridad: '', fecha_nac: '', sexo: '', estado_civil: '',

    finca: '', depto: 'Tolima', municipio: 'Rioblanco', altitud_msnm: '',
    latitud: '', longitud: '', area_total_ha: '', area_cafe_ha: '',
    area_prod_ha: '', area_levante_ha: '', area_bosque_ha: '',
    otros_cultivos_ha: '', pastos_ha: '', renovacion_ha: '',
    produccion_anual: '', unidad_prod: '', fuente_agua: '',
    trat_mieles_sn: '', tipo_tratamiento: '', fosa_pulpa: '',
    analisis_suelos: '', ano_analisis: '', acceso_vial: '',

    beneficiadero: '', despulpadora: '', fermentacion: '', secado: '',
    bodega: '', energia: '', internet: '', red_celular: '', operador: '',

    lotes: [loteVacio()],

    cosecha_ppal: '', mitaca: '', meses_detalle: '', ferm_horas: '',
    lavado: '', proc_especiales: '', tipo_proceso: '', cual_proceso: '',
    obs_cosecha: '',

    certificaciones: '', tipo_certif: '', cual_certif: '', concursos: '',
    nombre_concurso: '', conoce_puntaje: '', puntaje_taza: '', primas: '',
    comprador: '', precio_cop: '', obs_calidad: '',
  };
};
