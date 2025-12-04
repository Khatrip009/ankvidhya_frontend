// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: "/",   // CUSTOM DOMAIN MUST ALWAYS USE "/"
  build: {
    chunkSizeWarningLimit: 1500
  }
});
