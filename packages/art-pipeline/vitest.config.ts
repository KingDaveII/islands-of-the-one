import { defineProject } from 'vitest/config';
import { sourceConditions } from '../../vitest.shared.js';

export default defineProject({
  ...sourceConditions,
  test: { include: ['test/**/*.test.ts'], testTimeout: 60_000 },
});
