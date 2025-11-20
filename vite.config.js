import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use explicit env override or production mode to enable gh-pages base.
  // Set DEPLOY_TARGET=gh-pages when deploying, or rely on mode==='production'
  const deployTarget = process.env.DEPLOY_TARGET || '';
  const isGhPages = deployTarget === 'gh-pages' || mode === 'production';

  return {
    plugins: [react()],
    // IMPORTANT: match your GitHub repo name EXACTLY and case-sensitively
    base: isGhPages ? '/ankvidhya_frontend/' : '/',
    build: {
      chunkSizeWarningLimit: 1500, // 1.5 MB - you bumped this earlier
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
