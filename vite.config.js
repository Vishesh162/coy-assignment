import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/feed': 'http://127.0.0.1:3107',
      '/swipe': 'http://127.0.0.1:3107',
      '/matches': 'http://127.0.0.1:3107',
      '/health': 'http://127.0.0.1:3107',
    },
  },
});
