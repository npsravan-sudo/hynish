/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@hynish/domain': fileURLToPath(
        new URL('../../packages/domain/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Rollup's automatic splitting keeps the React ecosystem correctly ordered; feature
    // routes are already code-split via lazy imports. We only raise the warning threshold to
    // account for the eagerly-loaded shell vendor (React, Radix, router). Manual vendor
    // splitting is deferred until it is proven safe (avoids cross-chunk React interop bugs).
    chunkSizeWarningLimit: 700,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
