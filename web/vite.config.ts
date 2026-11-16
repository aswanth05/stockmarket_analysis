/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site under /<repo-name>/; the deploy workflow sets VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  server: {
    port: 5173,
    // The browser only ever talks to our own server; provider keys stay there.
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3001' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
