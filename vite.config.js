import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  // changeOrigin rewrites Host to localhost:4321 so the server's localhost check passes in dev.
  server: { proxy: { '/api': { target: 'http://localhost:4321', changeOrigin: true } } },
  test: { root: '.', include: ['server/**/*.test.js', 'web/**/*.test.js'] },
});
