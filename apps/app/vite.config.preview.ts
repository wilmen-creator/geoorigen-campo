import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Config aparte solo para generar un .html de un solo archivo, útil para
// probar la app en el navegador sin necesidad de Android Studio.
// Uso: npx vite build --config vite.config.preview.ts
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
