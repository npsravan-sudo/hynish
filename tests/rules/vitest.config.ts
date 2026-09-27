import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Rules tests talk to the emulator sequentially to keep seeded state predictable.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
