/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// `base: './'` emits relative asset URLs, so the same build works at
// https://<user>.github.io/<repo>/ and at a custom domain root. Routing uses
// HashRouter, so no server-side rewrites are required. Set VITE_BASE to
// override (e.g. VITE_BASE=/engineer-learning-guide/).
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // The curriculum is ~1 MB of lesson text needed on first paint; split it
    // and vendor code into their own long-cacheable chunks.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/data/curriculum/')) return 'curriculum';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
