import { Client, type Room } from '@colyseus/sdk';
import {
  ClientMessage,
  PROTOCOL_VERSION,
  RoomName,
  ServerMessage,
  lettersFromPositions,
  type PongPayload,
  type WelcomePayload,
} from '@iot/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.js';
import { createDb, type DbHandle } from '../src/db/client.js';

describe('TestRoom over a real WebSocket', () => {
  let db: DbHandle;
  let app: App;
  let client: Client;

  beforeAll(async () => {
    db = await createDb();
    await db.migrate();
    app = await createApp({ db, devCors: true });
    const address = await app.listen(0, '127.0.0.1');
    client = new Client(address.replace(/^http/, 'ws'));
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it('serves /health and matchmaking on the same port', async () => {
    const address = app.http.server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    const res = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(res.status).toBe(200);
  });

  it('sends CORS headers on cross-origin matchmake responses', async () => {
    const address = app.http.server.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    const res = await fetch(`http://127.0.0.1:${address.port}/matchmake/joinOrCreate/test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ protocolVersion: PROTOCOL_VERSION }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('joins, receives welcome, answers ping and syncs state', async () => {
    let welcome: WelcomePayload | undefined;
    const room: Room = await client.joinOrCreate(RoomName.Test, {
      name: 'tester',
      protocolVersion: PROTOCOL_VERSION,
    });
    room.onMessage(ServerMessage.Welcome, (msg: WelcomePayload) => {
      welcome = msg;
    });

    const pong = await new Promise<PongPayload>((resolve) => {
      room.onMessage(ServerMessage.Pong, resolve);
      room.send(ClientMessage.Ping, { sentAt: 123 });
    });
    expect(pong.sentAt).toBe(123);
    expect(welcome?.sessionId).toBe(room.sessionId);

    room.send(ClientMessage.Move, { x: 10, y: 20 });
    await expect
      .poll(() =>
        (room.state as { players: Map<string, { x: number; y: number }> }).players.get(
          room.sessionId,
        ),
      )
      .toMatchObject({ x: 10, y: 20 });

    await room.leave();
  });

  it('replaces a display name the safe-letters filter rejects', async () => {
    const room: Room = await client.joinOrCreate(RoomName.Test, {
      name: lettersFromPositions([9, 4, 5, 4]),
      protocolVersion: PROTOCOL_VERSION,
    });
    await expect
      .poll(
        () =>
          (room.state as { players: Map<string, { name: string }> }).players.get(room.sessionId)
            ?.name,
      )
      .toBe(`player-${room.sessionId.slice(0, 4)}`);
    await room.leave();
  });

  it('rejects clients with a mismatched protocol version', async () => {
    await expect(
      client.joinOrCreate(RoomName.Test, { protocolVersion: PROTOCOL_VERSION + 1 }),
    ).rejects.toThrow(/protocol mismatch/);
  });
});
