import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load root .env so PORT matches backend
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '../..'), '');
  const apiPort = rootEnv.PORT || '3001';
  const apiTarget = `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
      },
    },
  };
});
