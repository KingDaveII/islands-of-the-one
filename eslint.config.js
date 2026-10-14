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
    // Items and currency: every change goes through inventory.apply(), which writes the ledger
    // in the same transaction. Only the inventory module may reach the item tables
    // (docs/design/inventory.md; test/inventory-boundary.test.ts also checks raw SQL).
    files: ['apps/server/**/*.ts'],
    ignores: ['apps/server/src/inventory/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/inventory/tables', '**/inventory/tables.js'],
              message: 'Only the inventory module touches the item tables: use inventory.apply() and its readers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/client/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // One text path: every piece of text is a BitmapText from the pixel atlases, made by
    // label()/body() in render/text.ts. Phaser Text is rasterized by the browser's font engine,
    // which differs per OS and browser (readability.md §4).
    files: ['apps/client/src/**/*.ts'],
    ignores: ['apps/client/src/render/text.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='text'][callee.object.property.name='add']",
          message: 'No Phaser Text (browser-rasterized): use label()/body() from render/text.ts.',
        },
        {
          selector: "CallExpression[callee.property.name='bitmapText'][callee.object.property.name='add']",
          message: 'Create text through label()/body() in render/text.ts, the one text path.',
        },
        {
          selector: "NewExpression[callee.property.name=/^(Text|BitmapText)$/][callee.object.property.name='GameObjects']",
          message: 'Create text through label()/body() in render/text.ts, the one text path.',
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Playtest tooling drives the client in a browser: page scripts use browser globals.
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
