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
    rollupOptions: {
      output: {
        // Split ONLY the Firebase SDK (and charts) into their own chunks. These have no React
        // interop, so this is safe — unlike splitting React/Radix, which broke initialization.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](firebase|@firebase|@grpc|protobufjs|@protobufjs)[\\/]/.test(id)) return 'firebase';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
