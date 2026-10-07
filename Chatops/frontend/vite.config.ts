import { defineConfig } from 'vite';

const backendTarget = process.env.DOCKER_BACKEND_URL || 'http://localhost:3002';
const websocketTarget = process.env.DOCKER_WS_URL || 'ws://localhost:9001';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: websocketTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
