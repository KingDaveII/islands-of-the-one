import { isDrawable, type HealthResponse } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import type { ApiResult } from '../api.js';
import { buildDate, buildLabelText, clientBuild, createBuildStore, shortBuild } from './build.js';

const SHA = '8443ba3f0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f';
const OTHER = '19ef73d0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6';
const AT = '2026-10-17T12:40:31Z';

describe('the build label', () => {
  it('reads the baked-in build; blank or dev is a dev build', () => {
    expect(clientBuild({ VITE_BUILD_SHA: SHA, VITE_BUILD_TIME: AT })).toEqual({
      sha: SHA,
      builtAt: AT,
    });
    expect(clientBuild({})).toEqual({ sha: null, builtAt: null });
    expect(clientBuild({ VITE_BUILD_SHA: 'dev', VITE_BUILD_TIME: '' })).toEqual({
      sha: null,
      builtAt: null,
    });
    expect(clientBuild({ VITE_BUILD_SHA: ' ' })).toEqual({ sha: null, builtAt: null });
  });

  it('names a build by the first 7 characters of its SHA', () => {
    expect(shortBuild(SHA)).toBe('8443ba3');
    expect(shortBuild(null)).toBe('dev');
    expect(shortBuild('dev')).toBe('dev');
  });

  it('writes the build date as YYYY-MM-DD HH:MM in UTC', () => {
    expect(buildDate(AT)).toBe('2026-10-17 12:40');
    expect(buildDate('2026-10-17T23:59:59+02:00')).toBe('2026-10-17 21:59');
    expect(buildDate('2026-01-05T03:04:00.000Z')).toBe('2026-01-05 03:04');
    expect(buildDate('yesterday')).toBeNull();
    expect(buildDate(null)).toBeNull();
  });

  it('is the SHA and the date, or dev', () => {
    expect(buildLabelText({ sha: SHA, builtAt: AT }, null)).toBe(
      'build 8443ba3 · 2026-10-17 12:40',
    );
    expect(buildLabelText({ sha: SHA, builtAt: null }, null)).toBe('build 8443ba3');
    expect(buildLabelText({ sha: null, builtAt: AT }, null)).toBe('build dev');
    expect(buildLabelText({ sha: null, builtAt: null }, null)).toBe('build dev');
  });

  it("shows the server's build only when it differs", () => {
    expect(buildLabelText({ sha: SHA, builtAt: AT }, SHA)).toBe('build 8443ba3 · 2026-10-17 12:40');
    expect(buildLabelText({ sha: SHA, builtAt: AT }, OTHER)).toBe(
      'build 8443ba3 · 2026-10-17 12:40 · server 19ef73d',
    );
    expect(buildLabelText({ sha: null, builtAt: null }, 'dev')).toBe('build dev');
    expect(buildLabelText({ sha: null, builtAt: null }, OTHER)).toBe('build dev · server 19ef73d');
    expect(buildLabelText({ sha: SHA, builtAt: AT }, 'dev')).toBe(
      'build 8443ba3 · 2026-10-17 12:40 · server dev',
    );
  });

  it('uses only characters the pixel fonts draw', () => {
    expect(isDrawable(buildLabelText({ sha: SHA, builtAt: AT }, OTHER))).toBe(true);
    expect(isDrawable(buildLabelText({ sha: null, builtAt: null }, null))).toBe(true);
  });
});

describe('the build store', () => {
  const health = (answer: ApiResult<HealthResponse>) => {
    let calls = 0;
    return {
      calls: () => calls,
      fn: () => {
        calls++;
        return Promise.resolve(answer);
      },
    };
  };

  it("asks the server once and tells its listeners when the server's build comes in", async () => {
    const h = health({ ok: true, value: { status: 'ok', version: OTHER } });
    const store = createBuildStore({ sha: SHA, builtAt: AT }, h.fn);
    let told = 0;
    store.subscribe(() => told++);
    expect(store.snapshot()).toEqual({
      sha: SHA,
      builtAt: AT,
      server: null,
      label: 'build 8443ba3 · 2026-10-17 12:40',
    });
    await Promise.all([store.ask(), store.ask()]);
    await store.ask();
    expect(h.calls()).toBe(1);
    expect(told).toBe(1);
    expect(store.snapshot()).toEqual({
      sha: SHA,
      builtAt: AT,
      server: OTHER,
      label: 'build 8443ba3 · 2026-10-17 12:40 · server 19ef73d',
    });
  });

  it("keeps the client's build alone when the server can't be reached", async () => {
    const h = health({ ok: false, status: 0, error: 'unreachable', message: 'no' });
    const store = createBuildStore({ sha: null, builtAt: null }, h.fn);
    let told = 0;
    store.subscribe(() => told++);
    await store.ask();
    expect(told).toBe(0);
    expect(store.snapshot()).toEqual({
      sha: null,
      builtAt: null,
      server: null,
      label: 'build dev',
    });
  });
});
