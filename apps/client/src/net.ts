import { Client, type Room } from '@colyseus/sdk';
import {
  ClientMessage,
  PROTOCOL_VERSION,
  RoomName,
  ServerMessage,
  type JoinOptions,
  type MovePayload,
  type PingPayload,
  type PlayerView,
  type PongPayload,
} from '@iot/shared';

/** The subset of a decoded Colyseus MapSchema the client relies on. */
export interface SyncedMap<V> {
  readonly size: number;
  has(key: string): boolean;
  get(key: string): V | undefined;
  forEach(cb: (value: V, key: string) => void): void;
}

export interface TestRoomState {
  players: SyncedMap<PlayerView>;
}

export interface Connection {
  room: Room;
  sessionId: string;
  players(): SyncedMap<PlayerView> | undefined;
  ping(): void;
  move(payload: MovePayload): void;
  onPong(cb: (rttMs: number) => void): void;
  onClose(cb: (code: number) => void): void;
}

export async function connect(serverUrl: string, name?: string): Promise<Connection> {
  const client = new Client(serverUrl);
  const options: JoinOptions = { protocolVersion: PROTOCOL_VERSION, ...(name ? { name } : {}) };
  const room: Room = await client.joinOrCreate(RoomName.Test, options);

  return {
    room,
    sessionId: room.sessionId,
    players: () => (room.state as Partial<TestRoomState> | undefined)?.players,
    ping: () => {
      const payload: PingPayload = { sentAt: performance.now() };
      room.send(ClientMessage.Ping, payload);
    },
    move: (payload) => {
      room.send(ClientMessage.Move, payload);
    },
    onPong: (cb) => {
      room.onMessage(ServerMessage.Pong, (msg: PongPayload) => {
        cb(performance.now() - msg.sentAt);
      });
    },
    onClose: (cb) => {
      room.onLeave(cb);
    },
  };
}
