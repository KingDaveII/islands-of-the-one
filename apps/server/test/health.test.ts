import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';

describe('GET /health', () => {
  let db: DbHandle;
  let app: App;

  beforeAll(async () => {
    db = await createDb();
    await db.migrate();
    app = await createApp({ db, version: 'abc123' });
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it('reports ok with the database kind', async () => {
    const res = await app.http.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'pglite', version: 'abc123' });
  });
});

describe('matchmaking CORS', () => {
  let db: DbHandle;
  let app: App;
  let baseUrl: string;

  beforeAll(async () => {
    db = await createDb();
    await db.migrate();
    app = await createApp({ db });
    baseUrl = await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it('is off by default (deployed builds are same-origin)', async () => {
    // A real request: inject() would bypass the raw HTTP handler under test.
    const res = await fetch(`${baseUrl}/matchmake/joinOrCreate/test`, {
      method: 'POST',
      headers: { origin: 'https://other.example', 'content-type': 'application/json' },
      body: JSON.stringify({ protocolVersion: 1 }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
