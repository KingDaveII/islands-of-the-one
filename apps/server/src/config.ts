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
  /** Session cookies carry Secure everywhere but local dev (deployed builds are HTTPS behind Caddy). */
  secureCookies: boolean;
  /**
   * Which proxies may set X-Forwarded-For (the client IP the account rate
   * limits key on). `TRUST_PROXY` overrides: "true", "false", or a list of
   * addresses/CIDRs/proxy-addr names. Production default: private ranges,
   * where Caddy sits on the compose network (the server publishes no port).
   */
  trustProxy: boolean | string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? DEFAULT_SERVER_PORT);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env.PORT ?? ''}`);
  }
  const production = env.NODE_ENV === 'production';
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL || undefined,
    pgliteDir: env.PGLITE_DIR || undefined,
    devCors: !production,
    version: env.APP_VERSION || 'dev',
    secureCookies: production,
    trustProxy: parseTrustProxy(env.TRUST_PROXY, production),
  };
}

function parseTrustProxy(value: string | undefined, production: boolean): boolean | string {
  if (value === undefined || value === '')
    return production ? 'loopback,linklocal,uniquelocal' : false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
