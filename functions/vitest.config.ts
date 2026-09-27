import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    // Source uses NodeNext '.js' specifiers; map them to '.ts' for the test runner.
    extensionAlias: { '.js': ['.ts', '.js'] },
    alias: {
      '@hynish/domain': fileURLToPath(new URL('../packages/domain/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
