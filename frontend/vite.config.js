import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://backend:8080',
          changeOrigin: true,
          headers: {
            'x-admin-key': env.ADMIN_API_KEY || 'change-me-admin-key'
          },
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
});
