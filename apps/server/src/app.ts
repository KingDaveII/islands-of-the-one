import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createNodeMatchmakingMiddleware, matchMaker, Server as GameServer } from '@colyseus/core';
import { setTransport } from '@colyseus/core/Transport';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { PROTOCOL_VERSION, RoomName } from '@iot/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import type { DbHandle } from './db/client.js';
import { TestRoom } from './rooms/TestRoom.js';

export interface AppOptions {
  db: DbHandle;
  logger?: boolean;
}

export interface App {
  http: FastifyInstance;
  game: GameServer;
  listen(port: number, host?: string): Promise<string>;
  close(): Promise<void>;
}

/**
 * Fastify owns the HTTP server. Colyseus shares it: its matchmaking routes
 * (`/matchmake/*`) are handled first, everything else falls through to Fastify,
 * and WebSocket upgrades go to the Colyseus transport.
 */
export async function createApp({ db, logger = false }: AppOptions): Promise<App> {
  const matchmaking = createNodeMatchmakingMiddleware();
  const http = Fastify({
    logger,
    serverFactory: (handler) =>
      createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.url?.startsWith(`/${matchMaker.controller.matchmakeRoute}/`)) {
          setMatchmakeCorsHeaders(req, res);
        }
        void matchmaking(req, res, () => {
          handler(req, res);
        });
      }),
  });

  http.get('/health', async (_req, reply) => {
    try {
      await db.ping();
      return { status: 'ok', db: db.kind, protocolVersion: PROTOCOL_VERSION };
    } catch (err) {
      http.log.error(err, 'health check: database unreachable');
      return reply.code(503).send({ status: 'error', db: db.kind });
    }
  });

  const transport = new WebSocketTransport();
  transport.attachToServer(http.server);
  setTransport(transport);

  const game = new GameServer({ transport, greet: false, gracefullyShutdown: false });
  game.define(RoomName.Test, TestRoom);

  await http.ready();
  await matchMaker.accept();

  return {
    http,
    game,
    listen: (port, host = '0.0.0.0') => http.listen({ port, host }),
    async close() {
      await matchMaker.gracefullyShutdown();
      transport.shutdown();
      await http.close();
    },
  };
}

/**
 * The raw-node matchmaking adapter only adds CORS headers to preflight
 * responses (it was built for same-origin use under Vite). The client is
 * served from a different origin, so add them to every matchmake response.
 */
function setMatchmakeCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }
  const cors = {
    ...matchMaker.controller.DEFAULT_CORS_HEADERS,
    ...matchMaker.controller.getCorsHeaders(headers),
  };
  for (const [key, value] of Object.entries(cors)) {
    res.setHeader(key, value);
  }
}
