import { describe, expect, it } from 'vitest';
import { API_PREFIX, DEFAULT_SERVER_PORT, HEALTH_ROUTE } from '@iot/shared';
import { DEV_PROXY } from '../vite.config.js';
import { resolveServerUrl } from './config.js';

const page = (protocol: string, host: string) => ({
  protocol,
  host,
  hostname: host.split(':')[0] ?? host,
});

describe('resolveServerUrl', () => {
  it('prefers the env URL', () => {
    expect(resolveServerUrl('wss://game.example', page('http:', 'x'), true)).toBe(
      'wss://game.example',
    );
  });

  it('uses the page origin in production', () => {
    expect(resolveServerUrl(undefined, page('https:', 'game.1.2.3.4.sslip.io'), true)).toBe(
      'wss://game.1.2.3.4.sslip.io',
    );
    expect(resolveServerUrl(undefined, page('http:', 'localhost:8080'), true)).toBe(
      'ws://localhost:8080',
    );
  });

  it('targets the server port on the page host in dev', () => {
    expect(resolveServerUrl(undefined, page('http:', 'localhost:5173'), false)).toBe(
      'ws://localhost:2567',
    );
    expect(resolveServerUrl(undefined, page('https:', 'a.b'), false)).toBe('wss://a.b:2567');
  });
});

describe('the dev proxy (vite.config.ts)', () => {
  it('forwards the shared API prefix and the health route to the server port', () => {
    expect(DEV_PROXY.prefixes).toEqual([API_PREFIX, HEALTH_ROUTE]);
    expect(DEV_PROXY.target).toBe(`http://localhost:${DEFAULT_SERVER_PORT}`);
  });
});
