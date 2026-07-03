# GeoOrigen Campo

App Android **offline-first** para captura de datos de campo en finca.
Actualmente tiene dos módulos:

- **☕ Línea Base Café**: formulario fijo (Productor, Finca, Infraestructura,
  Lotes dinámicos 1-5, Cosecha, Calidad).
- **🌱 Línea Base Cacao**: formulario genérico armado a partir de un esquema
  (19 secciones), con preguntas condicionales (ej. "Pertenece a asociación"
  despliega el resto de la sección solo si es Sí).

Los colaboradores la usan sin señal; cuando hay internet, sincronizan a
Supabase con un botón. Desde Supabase se exporta a Excel cuando quieras.

## Cómo funciona

1. **Captura offline**: cada registro se guarda automáticamente en el
   dispositivo (IndexedDB, vía Dexie) mientras se va llenando. No se pierde
   nada si se cierra la app o se acaba la señal.
2. **Pantalla de Inicio**: elige entre los módulos disponibles (Café / Cacao).
3. **Lista por módulo**: muestra los registros guardados con un sello
   `BORRADOR` o `SINCRONIZADO`.
4. **Sincronizar**: sube solo los registros pendientes de ese módulo.
5. **Exportar a Excel**: desde Supabase exportas las vistas
   `encuestas_linea_base_excel` (café) y `registros_cacao_excel` (cacao).

## 1. Configurar Supabase

1. En **SQL Editor**, ejecuta en este orden:
   - `supabase_schema.sql` (tabla y vista de Café)
   - `supabase_schema_generico.sql` (tabla `registros_campo` genérica y vista
     de Cacao — este mismo esquema sirve para futuros cultivos/formularios)
2. En **Authentication > Users**, crea un usuario por cada colaborador.
3. En **Project Settings > API**, copia `Project URL` y `anon public key`.

## 2. Configurar el proyecto localmente

```bash
npm install
cp .env.example .env
# Edita .env y pega tu Project URL y anon key
```

También puedes dejar `.env` vacío y configurar la URL/llave **dentro de la
app** (pantalla de Ajustes).

## 3. Generar el APK con Android Studio

Necesitas **Android Studio** (con el SDK de Android) y **JDK 17**.

```bash
npm run android
```

Compila la app, sincroniza los assets con el proyecto nativo, y abre
Android Studio. Desde ahí: **Build > Generate Signed Bundle / APK**, elige
`APK`, crea/reutiliza tu keystore (guárdalo bien), selecciona `release`, y
genera. El archivo queda en `android/app/release/app-release.apk`.

## 4. Probar rápido sin Android Studio

```bash
npx vite build --config vite.config.preview.ts
```

Genera `dist-preview/index.html`, un solo archivo que abre directo en
cualquier navegador (sin servidor) — útil para iterar el diseño de
formularios antes de recompilar el APK.

## 5. Distribuir a colaboradores

Sube el `.apk` a Drive o a tu servidor, comparte el link por WhatsApp, y
cada colaborador permite "instalar apps de fuentes desconocidas". Al abrir
la app, entra a Ajustes e inicia sesión con su usuario de Supabase Auth.

## Estructura del proyecto

```
src/
  types.ts                    Modelo de datos de Café (campos fijos)
  db.ts                       Almacenamiento offline (Dexie / IndexedDB)
                               - tabla 'encuestas' (café)
                               - tabla 'registros' (genérica: cacao y futuros)
  supabase.ts                 Cliente Supabase (config editable desde Ajustes)
  sync.ts                     Sincronización de ambos módulos
  opciones.ts                 Listas de opciones de Café
  generico/
    tipos.ts                    Motor de esquemas: CampoSchema, SeccionSchema,
                                 EsquemaRegistro, lógica de campos condicionales
                                 (dependeDe / campoVisible)
    schema-cacao.ts             Esquema completo de Cacao (19 secciones)
    opciones-cacao.ts           Listas de opciones de Cacao
  components/
    Wizard.tsx                  Formulario de Café (6 secciones, fijo)
    SeccionProductor.tsx        Productor, Finca, Infraestructura (café)
    SeccionLotes.tsx             Lotes dinámicos 1-5 (café)
    SeccionCosecha.tsx           Cosecha y Calidad (café)
    WizardGenerico.tsx          Formulario genérico (usado por Cacao)
    CampoDesdeEsquema.tsx       Renderiza un campo según su definición de esquema
    Campos.tsx                   Primitivas de UI: texto, número, select, sí/no
    Inicio.tsx                   Selector de módulo (Café / Cacao)
    ListaEncuestas.tsx           Lista + sincronizar (café)
    ListaGenerica.tsx            Lista + sincronizar (genérico)
    Ajustes.tsx                   Configuración de Supabase y login
supabase_schema.sql            Tabla y vista de exportación — Café
supabase_schema_generico.sql   Tabla genérica + vista de exportación — Cacao
vite.config.preview.ts         Config para generar el HTML de un solo archivo
```

## Cómo agregar un nuevo formulario/cultivo

No hace falta tocar componentes visuales. Solo:

1. Crea `src/generico/schema-<nombre>.ts` con las secciones/campos (ver
   `schema-cacao.ts` como referencia, incluye ejemplos de campos calculados
   y condicionales).
2. Agrégalo en `App.tsx` siguiendo el mismo patrón que el módulo Cacao
   (nueva entrada en `Vista`, `listarRegistros('<tipo>')`,
   `sincronizarGenerico('<tipo>')`, tarjeta en `Inicio.tsx`).
3. Si quieres exportar a Excel con columnas planas, agrega una vista SQL
   nueva en `registros_campo` filtrando por `tipo = '<nombre>'` (mismo
   patrón que `registros_cacao_excel`).

## Notas

- El GPS (latitud/longitud) se captura con un botón — funciona sin internet.
- La seguridad real la da RLS + Supabase Auth (ver los `.sql`), no la llave
  `anon`.
- Los campos numéricos no aceptan negativos (bloqueado en `Campos.tsx`).

