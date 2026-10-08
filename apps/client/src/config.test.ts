import { describe, expect, it } from 'vitest';
import { resolveServerUrl } from './config.js';

describe('resolveServerUrl', () => {
  it('prefers the env URL', () => {
    expect(resolveServerUrl('wss://game.example', { protocol: 'http:', hostname: 'x' })).toBe(
      'wss://game.example',
    );
  });

  it('derives ws/wss from the page protocol', () => {
    expect(resolveServerUrl(undefined, { protocol: 'http:', hostname: 'localhost' })).toBe(
      'ws://localhost:2567',
    );
    expect(resolveServerUrl(undefined, { protocol: 'https:', hostname: 'a.b' })).toBe(
      'wss://a.b:2567',
    );
  });
});
