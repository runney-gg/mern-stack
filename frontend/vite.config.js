import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.SPENDWISE_API_URL || 'http://127.0.0.1:5001',
          changeOrigin: true,
        },
      },
    },
  };
});
