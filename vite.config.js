// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isGhPages = process.env.DEPLOY_TARGET === 'gh-pages' || mode === 'production';
  return {
    plugins: [react()],
    // safer: relative paths so gh-pages can serve from any folder
    base: isGhPages ? './' : '/',
    build: {
      chunkSizeWarningLimit: 1500,
      
    }
  };
});
