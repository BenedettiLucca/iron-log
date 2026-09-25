// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        __DEV__: 'readonly',
      },
    },
  },
  {
    // Guards migrated from source-grep Jest tests (deleted in the test audit):
    // - `as any` / `: any` was __tests__/quality/sprint-7-type-safety.test.ts.
    //   Warn (not error) until the ~69 existing production `any`s are paid down;
    //   flip to 'error' as part of that cleanup.
    // - `.transaction(async ...)` was __tests__/quality/expo-sqlite-transactions
    //   (first test). better-sqlite3 throws at runtime on async callbacks; this
    //   moves the guard to review time with zero test LOC.
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'hooks/**/*.ts', 'services/**/*.ts', 'src/**/*.{ts,tsx}', 'constants/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='transaction'] > ArrowFunctionExpression[async=true]",
          message: 'expo-sqlite .transaction() is synchronous: an async callback fails at runtime. Use a sync callback (see services/session-mutation for the pattern).',
        },
      ],
    },
  },
  {
    ignores: ['dist/*', '.expo/**'],
  },
]);
