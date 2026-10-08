import { DEFAULT_SERVER_PORT } from '@iot/shared';

export interface Config {
  port: number;
  host: string;
  /** Postgres connection string. When unset, an embedded PGlite database is used. */
  databaseUrl: string | undefined;
  /** Directory for PGlite data; unset means in-memory. */
  pgliteDir: string | undefined;
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
  };
}
