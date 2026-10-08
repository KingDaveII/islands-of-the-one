import { defineProject } from 'vitest/config';
import { sourceConditions } from '../../vitest.shared.js';

export default defineProject({
  ...sourceConditions,
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
