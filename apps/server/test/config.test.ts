import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('enables dev CORS outside production only', () => {
    expect(loadConfig({}).devCors).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production' }).devCors).toBe(false);
  });

  it('reads the build version', () => {
    expect(loadConfig({}).version).toBe('dev');
    expect(loadConfig({ APP_VERSION: 'deadbeef' }).version).toBe('deadbeef');
  });
});
