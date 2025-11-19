import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isGhPages = process.env.DEPLOY_TARGET === 'gh-pages' || mode === 'production';
  return {
    plugins: [react()],
    base: isGhPages ? '/Ankvidhya_Frontend/' : '/',
    build: {
      chunkSizeWarningLimit: 1500, // bump limit to silence warning (1.5MB)
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) return 'vendor.react';
              if (id.includes('recharts')) return 'vendor.recharts';
              if (id.includes('formik') || id.includes('yup')) return 'vendor.form';
              return 'vendor';
            }
          }
        }
      }
    }
  };
});
