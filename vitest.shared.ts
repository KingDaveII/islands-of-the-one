import { defaultClientConditions, defaultServerConditions } from 'vite';
import type { UserConfig } from 'vite';

/**
 * Resolve workspace packages (`@iot/*`) to their TypeScript sources via the
 * custom `source` export condition, so tests and dev never need a prior build.
 */
export const sourceConditions = {
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
} satisfies UserConfig;
