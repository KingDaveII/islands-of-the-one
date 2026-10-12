import { Room, type Client } from '@colyseus/core';
import { schema, t, type SchemaType } from '@colyseus/schema';
import {
  ClientMessage,
  isMovePayload,
  isSafe,
  isPingPayload,
  PROTOCOL_VERSION,
  ServerMessage,
  type JoinOptions,
  type PongPayload,
  type WelcomePayload,
} from '@iot/shared';

export const PlayerState = schema(
  {
    name: t.string(),
    x: t.number(),
    y: t.number(),
  },
  'PlayerState',
);
export type PlayerState = SchemaType<typeof PlayerState>;

export const TestRoomState = schema(
  {
    players: t.map(PlayerState),
  },
  'TestRoomState',
);
export type TestRoomState = SchemaType<typeof TestRoomState>;

export const WORLD_SIZE = { width: 800, height: 600 } as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Minimal room used to prove the client <-> server pipeline works end to end. */
export class TestRoom extends Room<{ state: TestRoomState }> {
  override maxClients = 16;
  override state = new TestRoomState();

  override onCreate(): void {
    this.onMessage(ClientMessage.Ping, (client, message: unknown) => {
      if (!isPingPayload(message)) return;
      const pong: PongPayload = { sentAt: message.sentAt, serverTime: Date.now() };
      client.send(ServerMessage.Pong, pong);
    });

    this.onMessage(ClientMessage.Move, (client, message: unknown) => {
      if (!isMovePayload(message)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.x = clamp(message.x, 0, WORLD_SIZE.width);
      player.y = clamp(message.y, 0, WORLD_SIZE.height);
    });
  }

  override onAuth(_client: Client, options: Partial<JoinOptions> | undefined): boolean {
    if (options?.protocolVersion !== PROTOCOL_VERSION) {
      throw new Error(`protocol mismatch: expected ${PROTOCOL_VERSION}`);
    }
    return true;
  }

  override onJoin(client: Client, options?: Partial<JoinOptions>): void {
    const player = new PlayerState();
    // Display names are untrusted text: anything the safe-letters filter rejects gets the default.
    const wanted = typeof options?.name === 'string' ? options.name.slice(0, 32) : '';
    player.name = wanted && isSafe(wanted).ok ? wanted : `player-${client.sessionId.slice(0, 4)}`;
    player.x = WORLD_SIZE.width / 2;
    player.y = WORLD_SIZE.height / 2;
    this.state.players.set(client.sessionId, player);

    const welcome: WelcomePayload = {
      sessionId: client.sessionId,
      protocolVersion: PROTOCOL_VERSION,
    };
    client.send(ServerMessage.Welcome, welcome);
  }

  override onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}
