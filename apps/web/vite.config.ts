/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest mode: we own every routing rule in src/sw.ts (PWA-ARCHITECTURE §4).
      // vite-plugin-pwa injects the precache manifest into the compiled SW at build time.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // registerType: 'prompt' — do NOT auto-update; show AppUpdatePrompt instead.
      // The app posts SKIP_WAITING when the user explicitly chooses to update.
      registerType: 'prompt',
      // Disable in dev so the SW doesn't interfere with HMR.
      devOptions: { enabled: false },
      // We manage manifest.webmanifest ourselves in public/; tell the plugin not to generate one.
      manifest: false,
      injectManifest: {
        // Cache hashed JS/CSS/fonts/icons. Exclude source maps and screenshots.
        globPatterns: ['**/*.{js,css,woff2,png,svg,ico}'],
        globIgnores: ['**/screenshots/**', '**/*.map', '**/generate-icons*'],
        // Cache limit per entry: 5 MB (generous but prevents caching huge files).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
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
    // Exclude the SW file from test runs (it uses ServiceWorkerGlobalScope).
    exclude: ['src/sw.ts', '**/node_modules/**'],
  },
});
