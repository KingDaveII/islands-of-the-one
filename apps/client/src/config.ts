import { DEFAULT_SERVER_PORT } from '@iot/shared';

/** Resolve the game server WebSocket URL. */
export function resolveServerUrl(
  envUrl: string | undefined,
  location: { protocol: string; hostname: string },
): string {
  if (envUrl) return envUrl;
  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${location.hostname}:${DEFAULT_SERVER_PORT}`;
}
