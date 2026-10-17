import { ApiRoute, HEALTH_ROUTE, type MeResponse } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import { createApi, UNREACHABLE } from './api.js';

const ME: MeResponse = {
  account: { username: 'mira', createdAt: '2026-10-14T12:00:00.000Z' },
  kindled: null,
};

/** A fetch that answers with `status` and `body`, recording the calls. */
function fake(status: number, body?: unknown) {
  const calls: { input: string; init: RequestInit }[] = [];
  const fetchFn = (input: string, init: RequestInit): Promise<Response> => {
    calls.push({ input, init });
    const text = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    return Promise.resolve(new Response(text, { status }));
  };
  return { calls, api: createApi(fetchFn) };
}

describe('the API client', () => {
  it("GETs /health for the server's build; a page that answers with HTML is unreachable", async () => {
    const { calls, api } = fake(200, {
      status: 'ok',
      db: 'postgres',
      version: 'abc1234',
      protocolVersion: 1,
    });
    expect(await api.health()).toEqual({
      ok: true,
      value: { status: 'ok', db: 'postgres', version: 'abc1234', protocolVersion: 1 },
    });
    expect(calls[0]?.input).toBe(HEALTH_ROUTE);
    expect(calls[0]?.init).toMatchObject({ method: 'GET' });
    expect(await fake(200, '<!doctype html><title>dev</title>').api.health()).toMatchObject({
      ok: false,
      error: 'unreachable',
    });
    expect(await fake(503, { status: 'error', db: 'postgres' }).api.health()).toMatchObject({
      ok: false,
      error: 'unreachable',
    });
  });

  it('GETs /api/me with cookies and checks the response shape', async () => {
    const { calls, api } = fake(200, ME);
    expect(await api.me()).toEqual({ ok: true, value: ME });
    expect(calls[0]?.input).toBe(ApiRoute.Me);
    expect(calls[0]?.init).toMatchObject({ method: 'GET', credentials: 'include' });
  });

  it('GETs the inventory by place and checks its shape', async () => {
    const inventory = {
      purse: [{ itemId: 'sealed-gin', quantity: 12 }],
      pack: [],
      store: [{ itemId: 'black-stone', quantity: 3 }],
      baskets: {},
    };
    const { calls, api } = fake(200, inventory);
    expect(await api.inventory()).toEqual({ ok: true, value: inventory });
    expect(calls[0]?.input).toBe(ApiRoute.Inventory);
    expect(calls[0]?.init).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(
      await fake(200, {
        ...inventory,
        purse: [{ itemId: 'sealed-gin', quantity: -1 }],
      }).api.inventory(),
    ).toMatchObject({
      ok: false,
      error: 'unreachable',
    });
    // Task 2's shape no longer passes.
    expect(await fake(200, { items: [] }).api.inventory()).toMatchObject({
      ok: false,
      error: 'unreachable',
    });
  });

  it('POSTs a move and answers the new inventory, or the refusal', async () => {
    const inventory = {
      purse: [],
      pack: [{ itemId: 'black-stone', quantity: 3 }],
      store: [],
      baskets: {},
    };
    const { calls, api } = fake(200, inventory);
    const body = { itemId: 'black-stone', from: 'store', to: 'pack', quantity: 3 } as const;
    expect(await api.move(body)).toEqual({ ok: true, value: inventory });
    expect(calls[0]?.input).toBe(ApiRoute.InventoryMove);
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(body),
    });
    expect(await fake(409, { error: 'pack-full', message: 'Pack full.' }).api.move(body)).toEqual({
      ok: false,
      status: 409,
      error: 'pack-full',
      message: 'Pack full.',
    });
  });

  it('POSTs JSON', async () => {
    const { calls, api } = fake(201, ME);
    await api.register({ username: 'mira', password: 'correct horse' });
    expect(calls[0]?.input).toBe(ApiRoute.Register);
    expect(calls[0]?.init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'mira', password: 'correct horse' }),
    });
  });

  it('passes the server error through', async () => {
    const { api } = fake(401, {
      error: 'wrong-credentials',
      message: 'Wrong username or password.',
    });
    expect(await api.login({ username: 'mira', password: 'nope nope' })).toEqual({
      ok: false,
      status: 401,
      error: 'wrong-credentials',
      message: 'Wrong username or password.',
    });
  });

  it('treats a malformed or missing answer as unreachable', async () => {
    for (const { api } of [fake(200, { account: 'mira' }), fake(502, '<html>'), fake(500)]) {
      expect(await api.me()).toMatchObject({
        ok: false,
        error: 'unreachable',
        message: UNREACHABLE,
      });
    }
    const down = createApi(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await down.me()).toMatchObject({ ok: false, status: 0, error: 'unreachable' });
  });

  it('logs out with an empty JSON body (204)', async () => {
    const { calls, api } = fake(204);
    expect(await api.logout()).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.init.body).toBe('{}');
  });

  it('unwraps the created Kindled', async () => {
    const kindled = {
      name: 'Mira',
      remembrance: 'ash',
      clayTone: 'clay-red',
      createdAt: '2026-10-14T12:00:00.000Z',
    };
    const { api } = fake(201, { kindled });
    expect(await api.createKindled({ name: 'Mira', remembrance: 'ash' })).toEqual({
      ok: true,
      value: kindled,
    });
  });
});
