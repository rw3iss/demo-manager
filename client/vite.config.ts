import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The manager SPA is served under /manage in production (the server's
// MANAGER_BASE_PATH), so the bundle is built with that base. In dev, Vite runs
// on :5173 and proxies the API to the NestJS server on :8092.
export default defineConfig({
  base: '/manage/',
  plugins: [preact()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@styles': fileURLToPath(new URL('./styles', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8092', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
