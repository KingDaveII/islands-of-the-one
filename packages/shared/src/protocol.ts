/**
 * Wire protocol shared by client and server.
 * Keep this package dependency-free: plain types and constants only.
 */

export const PROTOCOL_VERSION = 8;

export const DEFAULT_SERVER_PORT = 2567;

/** Colyseus room names registered by the server. */
export const RoomName = {
  Test: 'test',
} as const;
export type RoomName = (typeof RoomName)[keyof typeof RoomName];

/** Message types sent client -> server. */
export const ClientMessage = {
  Ping: 'ping',
  Move: 'move',
} as const;
export type ClientMessage = (typeof ClientMessage)[keyof typeof ClientMessage];

/** Message types sent server -> client. */
export const ServerMessage = {
  Pong: 'pong',
  Welcome: 'welcome',
} as const;
export type ServerMessage = (typeof ServerMessage)[keyof typeof ServerMessage];

export interface PingPayload {
  /** Client timestamp (ms) echoed back in the pong. */
  sentAt: number;
}

export interface PongPayload {
  sentAt: number;
  serverTime: number;
}

export interface MovePayload {
  x: number;
  y: number;
}

export interface WelcomePayload {
  sessionId: string;
  protocolVersion: number;
}

export interface ClientMessages {
  [ClientMessage.Ping]: PingPayload;
  [ClientMessage.Move]: MovePayload;
}

export interface ServerMessages {
  [ServerMessage.Pong]: PongPayload;
  [ServerMessage.Welcome]: WelcomePayload;
}

/** Options passed by the client when joining a room. */
export interface JoinOptions {
  name?: string;
  protocolVersion: number;
}

/** Plain-data view of a player in the test room's synced state. */
export interface PlayerView {
  name: string;
  x: number;
  y: number;
}

export function isMovePayload(value: unknown): value is MovePayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.x === 'number' &&
    Number.isFinite(v.x) &&
    typeof v.y === 'number' &&
    Number.isFinite(v.y)
  );
}

export function isPingPayload(value: unknown): value is PingPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.sentAt === 'number' && Number.isFinite(v.sentAt);
}
