import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'apps/server/drizzle/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // Determinism: the sim must produce bit-identical results in every engine.
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['random', 'sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'exp', 'log', 'pow', 'hypot', 'cbrt', 'sqrt'].map(
          (property) => ({
            object: 'Math',
            property,
            message: 'Not deterministic across engines: use the sim helpers (trig.ts, fixed.ts, rng.ts).',
          }),
        ),
        { object: 'Date', property: 'now', message: 'No wall-clock time in the sim: use ticks.' },
        { object: 'performance', property: 'now', message: 'No wall-clock time in the sim: use ticks.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'No wall-clock time in the sim: use ticks.' },
        { name: 'setTimeout', message: 'No timers in the sim: use ticks.' },
        { name: 'setInterval', message: 'No timers in the sim: use ticks.' },
        { name: 'Map', message: 'Use arrays: iteration order must never affect results.' },
        { name: 'Set', message: 'Use arrays: iteration order must never affect results.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: 'Use integer multiplication.' },
      ],
    },
  },
  {
    files: ['apps/client/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
