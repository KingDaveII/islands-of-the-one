import { defineConfig } from 'vitest/config';
import { sourceConditions } from '../../vitest.shared.js';

/**
 * @iot/shared's API_PREFIX and DEFAULT_SERVER_PORT. Vite loads this file before its own
 * resolver (and so the `source` condition) is set up, so it can't import workspace sources;
 * src/config.test.ts checks these against the shared values.
 */
export const DEV_PROXY = { prefix: '/api', target: 'http://localhost:2567' } as const;

export default defineConfig({
  ...sourceConditions,
  server: {
    port: 5173,
    // The JSON API is same-origin (its session cookie and Origin check expect that): in dev,
    // Vite forwards /api to the server and keeps the page's Host header, which the server's
    // Origin check compares against (Vite's proxy rewrites it unless told not to).
    proxy: { [DEV_PROXY.prefix]: { target: DEV_PROXY.target, changeOrigin: false } },
  },
  // Phaser alone is ~1.2 MB minified, the sprite sheet contracts add ~150 kB; don't warn about it.
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1700 },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
  },
});
