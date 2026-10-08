import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/chat': {
        target: 'ws://localhost:8080',
        ws: true,
      },
      '/redsocial-media': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
});
