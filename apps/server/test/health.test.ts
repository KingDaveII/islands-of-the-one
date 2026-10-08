import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';

describe('GET /health', () => {
  let db: DbHandle;
  let app: App;

  beforeAll(async () => {
    db = await createDb();
    await db.migrate();
    app = await createApp({ db });
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it('reports ok with the database kind', async () => {
    const res = await app.http.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', db: 'pglite' });
  });
});
