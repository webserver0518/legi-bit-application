import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/login': 'http://backend:9000',
      '/logout': 'http://backend:9000',
      '/auth': 'http://backend:9000',
      '/api': 'http://backend:9000'
    }
  },
  build: {
    outDir: 'dist'
  }
});
