import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.ts',
      'scratch-*.mjs', // local verification scripts, never committed
      'functions/lib/**',
      'apps/web/src/components/ui/**', // shadcn-style primitives: allow their idioms
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**', '**/vitest.setup.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // No Firestore in the UI (Phase 3 §41). Features/components must go through
    // hooks -> services -> repositories. Direct firebase/firestore access is denied here.
    files: ['apps/web/src/features/**/*.{ts,tsx}', 'apps/web/src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'firebase/firestore', message: 'UI must not access Firestore directly — use a repository/service (Phase 3 §41).' },
          ],
          patterns: [
            { group: ['**/infrastructure/firestore/*', '**/lib/firebase/firestore'], message: 'UI must not access Firestore directly — use a repository/service (Phase 3 §41).' },
          ],
        },
      ],
    },
  },
);
