import { DEFAULT_SERVER_PORT } from '@iot/shared';

/**
 * Resolve the game server WebSocket URL.
 *
 * - `VITE_SERVER_URL`, when set, always wins.
 * - Production builds connect to the page's own origin (Caddy routes
 *   `/matchmake/*` and WebSocket upgrades to the server).
 * - Dev connects to the server's port on the page's host.
 */
export function resolveServerUrl(
  envUrl: string | undefined,
  location: { protocol: string; hostname: string; host: string },
  production: boolean,
): string {
  if (envUrl) return envUrl;
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (production) return `${wsProtocol}//${location.host}`;
  return `${wsProtocol}//${location.hostname}:${DEFAULT_SERVER_PORT}`;
}
