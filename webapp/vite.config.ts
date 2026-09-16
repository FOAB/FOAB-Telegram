import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Builds the Telegram Mini App bundle without exposing server configuration. */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
