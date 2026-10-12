import { defineConfig } from 'vitest/config';
import { sourceConditions } from '../../vitest.shared.js';

export default defineConfig({
  ...sourceConditions,
  server: { port: 5173 },
  // Phaser alone is ~1.2 MB minified, the sprite sheet contracts add ~150 kB; don't warn about it.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1700 },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
});
