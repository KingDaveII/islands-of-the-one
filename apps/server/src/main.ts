import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';

const config = loadConfig();
const db = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });

// Migrations are idempotent; applying them on every start keeps dev, CI and
// the Docker image in sync with the schema. Set SKIP_MIGRATIONS=1 to opt out.
if (!process.env.SKIP_MIGRATIONS) await db.migrate();

const app = await createApp({ db, logger: true, devCors: config.devCors, version: config.version });
const address = await app.listen(config.port, config.host);
app.http.log.info(`server ${config.version} listening on ${address} (db: ${db.kind})`);

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.http.log.info(`${signal} received, shutting down`);
  try {
    await app.close();
    await db.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
