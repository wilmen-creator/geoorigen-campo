import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

// Config aparte solo para generar un .html de un solo archivo, útil para
// probar la app en el navegador sin necesidad de Android Studio.
// Uso: npx vite build --config vite.config.preview.ts
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { __VERSION_APP__: JSON.stringify(version) },
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
