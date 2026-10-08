import { DEFAULT_SERVER_PORT } from '@iot/shared';

export interface Config {
  port: number;
  host: string;
  /** Postgres connection string. When unset, an embedded PGlite database is used. */
  databaseUrl: string | undefined;
  /** Directory for PGlite data; unset means in-memory. */
  pgliteDir: string | undefined;
  /**
   * Add CORS headers to matchmaking responses. Only needed in local dev, where
   * the client (Vite, :5173) and server (:2567) are different origins; deployed
   * builds serve both from one origin behind Caddy.
   */
  devCors: boolean;
  /** Build identifier (git SHA) reported by /health. */
  version: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? DEFAULT_SERVER_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT ?? ''}`);
  }
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR || undefined,
    devCors: env.NODE_ENV !== 'production',
    version: env.APP_VERSION || 'dev',
  };
}
