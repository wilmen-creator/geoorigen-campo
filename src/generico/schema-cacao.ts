import type { EsquemaRegistro } from './tipos';
import { TIPOS_DNI, ESCOLARIDAD, ESTADO_CIVIL } from '../opciones';
import { GENERO, TENENCIA, MATERIAL_VEGETAL, TIPO_SOMBRA, FRECUENCIA, CARGOS_JUNTA } from './opciones-cacao';

const calcEdad = (d: Record<string, string>) => {
  if (!d.fecha_nac) return '';
  const nac = new Date(d.fecha_nac);
  if (Number.isNaN(nac.getTime())) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 ? String(edad) : '';
};

const calcRendimiento = (d: Record<string, string>) => {
  const prod = parseFloat(d.produccion_anual);
  const area = parseFloat(d.area_cacao);
  if (!prod || !area) return '';
  return (prod / area).toFixed(1) + ' kg/ha';
};

export const esquemaCacao: EsquemaRegistro = {
  tipo: 'cacao',
  nombre: 'Línea Base Cacao',
  icono: '🌱',
  claveNombre: 'nombre',
  claveSubtitulo: 'nombre_predio',
  secciones: [
    {
      titulo: '1. Identificación',
      campos: [
        { key: 'fecha_encuesta', etiqueta: 'Fecha de la encuesta', tipo: 'fecha' },
        { key: 'encuestador', etiqueta: 'Encuestador', tipo: 'texto' },
        { key: 'nombre', etiqueta: 'Nombre completo', tipo: 'texto', ancho: 'completo', obligatorio: true },
        { key: 'tipo_dni', etiqueta: 'Tipo de documento', tipo: 'select', opciones: TIPOS_DNI },
        { key: 'dni', etiqueta: 'Número de documento', tipo: 'texto', obligatorio: true },
        { key: 'genero', etiqueta: 'Género', tipo: 'select', opciones: GENERO },
        { key: 'fecha_nac', etiqueta: 'Fecha de nacimiento', tipo: 'fecha' },
        { key: 'edad', etiqueta: 'Edad (calculada)', tipo: 'calculado', calcular: calcEdad },
        { key: 'estado_civil', etiqueta: 'Estado civil', tipo: 'select', opciones: ESTADO_CIVIL },
        { key: 'nivel_educativo', etiqueta: 'Nivel educativo', tipo: 'select', opciones: ESCOLARIDAD },
        { key: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
        { key: 'correo', etiqueta: 'Correo electrónico', tipo: 'email' },
      ],
    },
    {
      titulo: '2. Información del hogar',
      campos: [
        { key: 'num_integrantes', etiqueta: 'Número de integrantes', tipo: 'numero' },
        { key: 'personas_eco_activas', etiqueta: 'Personas económicamente activas', tipo: 'numero' },
        { key: 'mujeres', etiqueta: 'Mujeres', tipo: 'numero' },
        { key: 'hombres', etiqueta: 'Hombres', tipo: 'numero' },
        { key: 'jovenes', etiqueta: 'Jóvenes', tipo: 'numero' },
        { key: 'adultos_mayores', etiqueta: 'Adultos mayores', tipo: 'numero' },
        { key: 'mano_obra_familiar', etiqueta: 'Mano de obra familiar', tipo: 'numero' },
        { key: 'mano_obra_contratada', etiqueta: 'Mano de obra contratada', tipo: 'numero' },
        { key: 'actividad_principal', etiqueta: 'Actividad económica principal', tipo: 'texto', ancho: 'completo' },
        { key: 'actividades_secundarias', etiqueta: 'Actividades económicas secundarias', tipo: 'texto', ancho: 'completo' },
      ],
    },
    {
      titulo: '3. Organización',
      campos: [
        { key: 'pertenece_asociacion', etiqueta: 'Pertenece a asociación', tipo: 'sino' },
        { key: 'nombre_asociacion', etiqueta: 'Nombre de la asociación', tipo: 'texto', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
        { key: 'ano_ingreso', etiqueta: 'Año de ingreso', tipo: 'numero', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
        { key: 'participa_juntas', etiqueta: 'Participa en juntas', tipo: 'sino', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
        { key: 'cargo_junta', etiqueta: 'Cargo en la junta', tipo: 'select', opciones: CARGOS_JUNTA, dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }, { key: 'participa_juntas', valor: 'Si' }] },
        { key: 'recibe_asistencia', etiqueta: 'Recibe asistencia técnica', tipo: 'sino', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
        { key: 'institucion_asistencia', etiqueta: 'Institución que brinda asistencia', tipo: 'texto', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }, { key: 'recibe_asistencia', valor: 'Si' }] },
        { key: 'frecuencia_asistencia', etiqueta: 'Frecuencia de asistencia', tipo: 'select', opciones: FRECUENCIA, dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }, { key: 'recibe_asistencia', valor: 'Si' }] },
        { key: 'participa_ecas', etiqueta: 'Participa en escuelas de campo', tipo: 'sino', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
        { key: 'acceso_creditos', etiqueta: 'Acceso a créditos', tipo: 'sino', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
        { key: 'entidad_financiera', etiqueta: 'Entidad financiera', tipo: 'texto', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }, { key: 'acceso_creditos', valor: 'Si' }] },
        { key: 'acceso_incentivos', etiqueta: 'Acceso a incentivos gubernamentales', tipo: 'sino', dependeDe: [{ key: 'pertenece_asociacion', valor: 'Si' }] },
      ],
    },
    {
      titulo: '4. Localización',
      conGPS: true,
      campos: [
        { key: 'depto', etiqueta: 'Departamento', tipo: 'texto' },
        { key: 'municipio', etiqueta: 'Municipio/corregimiento', tipo: 'texto' },
        { key: 'vereda', etiqueta: 'Vereda', tipo: 'texto' },
        { key: 'indicaciones_llegada', etiqueta: 'Indicaciones de cómo llegar', tipo: 'texto', ancho: 'completo' },
        { key: 'altitud', etiqueta: 'Altitud (msnm)', tipo: 'numero' },
        { key: 'coord_lote_principal', etiqueta: 'Coordenadas lote principal', tipo: 'texto' },
        { key: 'distancia_casco_urbano', etiqueta: 'Distancia al casco urbano (km)', tipo: 'numero' },
        { key: 'tiempo_cabecera', etiqueta: 'Tiempo hasta la cabecera municipal (horas)', tipo: 'numero' },
      ],
    },
    {
      titulo: '5. Información del predio',
      campos: [
        { key: 'nombre_predio', etiqueta: 'Nombre del predio', tipo: 'texto', ancho: 'completo', obligatorio: true },
        { key: 'tenencia', etiqueta: 'Tenencia', tipo: 'select', opciones: TENENCIA },
        { key: 'area_total', etiqueta: 'Área total (ha)', tipo: 'numero' },
        { key: 'area_agricola', etiqueta: 'Área agrícola (ha)', tipo: 'numero' },
        { key: 'area_cacao', etiqueta: 'Área en cacao (ha)', tipo: 'numero' },
        { key: 'area_prod', etiqueta: 'Área en producción (ha)', tipo: 'numero' },
        { key: 'area_levante', etiqueta: 'Área en levante (ha)', tipo: 'numero' },
        { key: 'area_bosque', etiqueta: 'Área en bosque (ha)', tipo: 'numero' },
        { key: 'area_conservacion', etiqueta: 'Área en conservación (ha)', tipo: 'numero' },
        { key: 'area_otros_cultivos', etiqueta: 'Área en otros cultivos (ha)', tipo: 'numero' },
        { key: 'num_lotes', etiqueta: 'Número de lotes', tipo: 'numero' },
      ],
    },
    {
      titulo: '6. Características del cultivo',
      campos: [
        { key: 'ano_establecimiento', etiqueta: 'Año de establecimiento', tipo: 'numero' },
        { key: 'edad_promedio', etiqueta: 'Edad promedio (años)', tipo: 'numero' },
        { key: 'material_vegetal', etiqueta: 'Material vegetal', tipo: 'select', opciones: MATERIAL_VEGETAL },
        { key: 'clones_sembrados', etiqueta: 'Clones sembrados', tipo: 'texto' },
        { key: 'origen_material', etiqueta: 'Origen del material', tipo: 'texto' },
        { key: 'num_arboles', etiqueta: 'Número de árboles', tipo: 'numero' },
        { key: 'dist_arboles', etiqueta: 'Distancia entre árboles (m)', tipo: 'numero' },
        { key: 'dist_calle', etiqueta: 'Distancia entre calles (m)', tipo: 'numero' },
        { key: 'tipo_sombra', etiqueta: 'Tipo de sombra', tipo: 'select', opciones: TIPO_SOMBRA },
        { key: 'porcentaje_sombra', etiqueta: 'Porcentaje de sombra (%)', tipo: 'numero' },
        { key: 'arboles_sombrio_ha', etiqueta: 'Árboles de sombrío por hectárea', tipo: 'numero' },
        { key: 'injertacion', etiqueta: 'Injertación', tipo: 'sino' },
      ],
    },
    {
      titulo: '7. Manejo agronómico',
      campos: [
        { key: 'plan_fertilizacion', etiqueta: 'Plan de fertilización', tipo: 'sino' },
        { key: 'tipo_fertilizante', etiqueta: 'Tipo de fertilizante', tipo: 'texto', dependeDe: [{ key: 'plan_fertilizacion', valor: 'Si' }] },
        { key: 'fertilizacion_organica', etiqueta: 'Fertilización orgánica', tipo: 'sino', dependeDe: [{ key: 'plan_fertilizacion', valor: 'Si' }] },
        { key: 'fertilizacion_quimica', etiqueta: 'Fertilización química', tipo: 'sino', dependeDe: [{ key: 'plan_fertilizacion', valor: 'Si' }] },
        { key: 'enmiendas', etiqueta: 'Enmiendas', tipo: 'texto', dependeDe: [{ key: 'plan_fertilizacion', valor: 'Si' }] },
        { key: 'analisis_suelo', etiqueta: 'Análisis de suelo', tipo: 'sino' },
        { key: 'fecha_ultimo_analisis', etiqueta: 'Fecha del último análisis', tipo: 'fecha', dependeDe: [{ key: 'analisis_suelo', valor: 'Si' }] },
        { key: 'encalado', etiqueta: 'Encalado', tipo: 'sino' },
        { key: 'cobertura_vegetal', etiqueta: 'Cobertura vegetal', tipo: 'sino' },
        { key: 'manejo_arvenses', etiqueta: 'Manejo de arvenses', tipo: 'texto' },
        { key: 'riego', etiqueta: 'Riego', tipo: 'sino' },
        { key: 'drenaje', etiqueta: 'Drenaje', tipo: 'sino' },
      ],
    },
    {
      titulo: '8. Manejo fitosanitario',
      campos: [
        { key: 'principales_plagas', etiqueta: 'Principales plagas', tipo: 'texto', ancho: 'completo' },
        { key: 'principales_enfermedades', etiqueta: 'Principales enfermedades', tipo: 'texto', ancho: 'completo' },
        { key: 'moniliasis', etiqueta: 'Moniliasis', tipo: 'sino' },
        { key: 'escoba_bruja', etiqueta: 'Escoba de bruja', tipo: 'sino' },
        { key: 'mazorca_negra', etiqueta: 'Mazorca negra', tipo: 'sino' },
        { key: 'frecuencia_monitoreo', etiqueta: 'Frecuencia de monitoreo', tipo: 'select', opciones: FRECUENCIA },
        { key: 'control_biologico', etiqueta: 'Control biológico', tipo: 'sino' },
        { key: 'control_quimico', etiqueta: 'Control químico', tipo: 'sino' },
        { key: 'manejo_integrado', etiqueta: 'Manejo integrado', tipo: 'sino' },
        { key: 'registros_fitosanitarios', etiqueta: 'Registros fitosanitarios', tipo: 'sino' },
      ],
    },
    {
      titulo: '9. Podas',
      campos: [
        { key: 'poda_formacion', etiqueta: 'Poda de formación', tipo: 'sino' },
        { key: 'poda_mantenimiento', etiqueta: 'Poda de mantenimiento', tipo: 'sino' },
        { key: 'poda_sanitaria', etiqueta: 'Poda sanitaria', tipo: 'sino' },
        { key: 'frecuencia_poda', etiqueta: 'Frecuencia', tipo: 'select', opciones: FRECUENCIA },
        { key: 'herramientas_utilizadas', etiqueta: 'Herramientas utilizadas', tipo: 'texto', ancho: 'completo' },
      ],
    },
    {
      titulo: '10. Producción',
      campos: [
        { key: 'produccion_anual', etiqueta: 'Producción anual (kg)', tipo: 'numero' },
        { key: 'produccion_cosecha', etiqueta: 'Producción por cosecha (kg)', tipo: 'numero' },
        { key: 'rendimiento_kg_ha', etiqueta: 'Rendimiento (kg/ha)', tipo: 'calculado', calcular: calcRendimiento },
        { key: 'num_cosechas', etiqueta: 'Número de cosechas', tipo: 'numero' },
        { key: 'porcentaje_perdidas', etiqueta: 'Porcentaje de pérdidas (%)', tipo: 'numero' },
        { key: 'causas_perdidas', etiqueta: 'Causas de pérdidas', tipo: 'textarea' },
      ],
    },
    {
      titulo: '11. Cosecha y poscosecha',
      campos: [
        { key: 'fermentacion', etiqueta: 'Fermentación', tipo: 'sino' },
        { key: 'tipo_fermentador', etiqueta: 'Tipo de fermentador', tipo: 'texto', dependeDe: [{ key: 'fermentacion', valor: 'Si' }] },
        { key: 'tiempo_fermentacion', etiqueta: 'Tiempo de fermentación (días)', tipo: 'numero', dependeDe: [{ key: 'fermentacion', valor: 'Si' }] },
        { key: 'secado', etiqueta: 'Secado', tipo: 'sino' },
        { key: 'tipo_secador', etiqueta: 'Tipo de secador', tipo: 'texto', dependeDe: [{ key: 'secado', valor: 'Si' }] },
        { key: 'tiempo_secado', etiqueta: 'Tiempo de secado (días)', tipo: 'numero', dependeDe: [{ key: 'secado', valor: 'Si' }] },
        { key: 'humedad_final', etiqueta: 'Humedad final (%)', tipo: 'numero', dependeDe: [{ key: 'secado', valor: 'Si' }] },
        { key: 'almacenamiento', etiqueta: 'Almacenamiento', tipo: 'texto' },
        { key: 'empaque', etiqueta: 'Empaque', tipo: 'texto' },
      ],
    },
    {
      titulo: '12. Calidad',
      campos: [
        { key: 'clasificacion_grano', etiqueta: 'Clasificación del grano', tipo: 'texto' },
        { key: 'porcentaje_fermentacion', etiqueta: 'Porcentaje de fermentación (%)', tipo: 'numero' },
        { key: 'impurezas', etiqueta: 'Impurezas (%)', tipo: 'numero' },
        { key: 'certificaciones', etiqueta: 'Certificaciones', tipo: 'sino' },
        { key: 'cumplimiento_estandares', etiqueta: 'Cumplimiento de estándares', tipo: 'texto', dependeDe: [{ key: 'certificaciones', valor: 'Si' }] },
        { key: 'trazabilidad', etiqueta: 'Trazabilidad', tipo: 'sino' },
      ],
    },
    {
      titulo: '13. Comercialización',
      campos: [
        { key: 'comprador_principal', etiqueta: 'Comprador principal', tipo: 'texto' },
        { key: 'tipo_comprador', etiqueta: 'Tipo de comprador', tipo: 'texto' },
        { key: 'frecuencia_venta', etiqueta: 'Frecuencia de venta', tipo: 'select', opciones: FRECUENCIA },
        { key: 'precio_promedio', etiqueta: 'Precio promedio (COP)', tipo: 'numero' },
        { key: 'forma_pago', etiqueta: 'Forma de pago', tipo: 'texto' },
        { key: 'volumen_comercializado', etiqueta: 'Volumen comercializado (kg)', tipo: 'numero' },
        { key: 'valor_agregado', etiqueta: 'Valor agregado', tipo: 'sino' },
        { key: 'transformacion', etiqueta: 'Transformación', tipo: 'sino' },
        { key: 'acceso_mercados_diferenciados', etiqueta: 'Acceso a mercados diferenciados', tipo: 'sino' },
        { key: 'exportacion_indirecta', etiqueta: 'Exportación indirecta', tipo: 'sino' },
      ],
    },
    {
      titulo: '14. Infraestructura',
      campos: [
        { key: 'vivienda', etiqueta: 'Vivienda', tipo: 'sino' },
        { key: 'bodega', etiqueta: 'Bodega', tipo: 'sino' },
        { key: 'centro_acopio', etiqueta: 'Centro de acopio', tipo: 'sino' },
        { key: 'fermentadores', etiqueta: 'Fermentadores', tipo: 'sino' },
        { key: 'marquesina', etiqueta: 'Marquesina', tipo: 'sino' },
        { key: 'secador_solar', etiqueta: 'Secador solar', tipo: 'sino' },
        { key: 'secador_mecanico', etiqueta: 'Secador mecánico', tipo: 'sino' },
        { key: 'bascula', etiqueta: 'Báscula', tipo: 'sino' },
        { key: 'despulpadora', etiqueta: 'Despulpadora', tipo: 'sino' },
        { key: 'herramientas_infra', etiqueta: 'Herramientas', tipo: 'texto' },
        { key: 'motobomba', etiqueta: 'Motobomba', tipo: 'sino' },
        { key: 'vehiculo', etiqueta: 'Vehículo', tipo: 'sino' },
      ],
    },
    {
      titulo: '15. Medio ambiente',
      campos: [
        { key: 'nacimientos', etiqueta: 'Nacimientos de agua', tipo: 'sino' },
        { key: 'quebradas', etiqueta: 'Quebradas', tipo: 'sino' },
        { key: 'proteccion_rondas', etiqueta: 'Protección de rondas', tipo: 'sino' },
        { key: 'reforestacion', etiqueta: 'Reforestación', tipo: 'sino' },
        { key: 'conservacion_bosques', etiqueta: 'Conservación de bosques', tipo: 'sino' },
        { key: 'biodiversidad', etiqueta: 'Biodiversidad', tipo: 'texto' },
        { key: 'polinizadores', etiqueta: 'Polinizadores', tipo: 'sino' },
        { key: 'manejo_residuos', etiqueta: 'Manejo de residuos', tipo: 'texto' },
        { key: 'compostaje', etiqueta: 'Compostaje', tipo: 'sino' },
        { key: 'envases_agroquimicos', etiqueta: 'Envases de agroquímicos', tipo: 'texto' },
        { key: 'captura_carbono', etiqueta: 'Captura de carbono', tipo: 'sino' },
      ],
    },
    {
      titulo: '16. Cambio climático',
      campos: [
        { key: 'percepcion_cambio_climatico', etiqueta: 'Percepción del cambio climático', tipo: 'textarea' },
        { key: 'eventos_extremos', etiqueta: 'Eventos extremos', tipo: 'texto' },
        { key: 'sequias', etiqueta: 'Sequías', tipo: 'sino' },
        { key: 'exceso_lluvia', etiqueta: 'Exceso de lluvia', tipo: 'sino' },
        { key: 'estrategias_adaptacion', etiqueta: 'Estrategias de adaptación', tipo: 'textarea' },
        { key: 'sistemas_agroforestales', etiqueta: 'Sistemas agroforestales', tipo: 'sino' },
        { key: 'variedades_resilientes', etiqueta: 'Variedades resilientes', tipo: 'sino' },
      ],
    },
    {
      titulo: '17. Aspecto económico',
      campos: [
        { key: 'costos_produccion', etiqueta: 'Costos de producción (COP)', tipo: 'numero' },
        { key: 'costos_cosecha', etiqueta: 'Costos de cosecha (COP)', tipo: 'numero' },
        { key: 'costos_fertilizacion', etiqueta: 'Costos de fertilización (COP)', tipo: 'numero' },
        { key: 'ingresos_cacao', etiqueta: 'Ingresos por cacao (COP)', tipo: 'numero' },
        { key: 'otros_ingresos', etiqueta: 'Otros ingresos (COP)', tipo: 'numero' },
      ],
    },
    {
      titulo: '18. Tecnología',
      campos: [
        { key: 'smartphone', etiqueta: 'Smartphone', tipo: 'sino' },
        { key: 'computador', etiqueta: 'Computador', tipo: 'sino' },
        { key: 'internet', etiqueta: 'Internet', tipo: 'sino' },
        { key: 'cobertura_celular', etiqueta: 'Cobertura celular', tipo: 'sino' },
        { key: 'whatsapp', etiqueta: 'WhatsApp', tipo: 'sino' },
        { key: 'uso_apps_agricolas', etiqueta: 'Uso de aplicaciones agrícolas', tipo: 'sino' },
      ],
    },
    {
      titulo: '19. Seguridad y bienestar',
      campos: [
        { key: 'agua_potable', etiqueta: 'Agua potable', tipo: 'sino' },
        { key: 'energia_electrica', etiqueta: 'Energía eléctrica', tipo: 'sino' },
        { key: 'alcantarillado', etiqueta: 'Alcantarillado', tipo: 'sino' },
        { key: 'manejo_residuos_bienestar', etiqueta: 'Manejo de residuos', tipo: 'texto' },
        { key: 'afiliacion_salud', etiqueta: 'Afiliación a salud', tipo: 'sino' },
        { key: 'riesgos_laborales', etiqueta: 'Riesgos laborales', tipo: 'texto' },
        { key: 'elementos_proteccion', etiqueta: 'Elementos de protección personal', tipo: 'texto' },
      ],
    },
  ],
};
