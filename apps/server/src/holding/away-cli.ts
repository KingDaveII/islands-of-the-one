import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { moveAway, parseAwayArgs } from './away.js';

/**
 * pnpm --filter @iot/server holding:away <username> <hours>
 *
 * Moves the Kindled's active action back `hours` (its start and its last
 * heartbeat), as if it had been away that long: the next holding request
 * settles it as offline time, up to the cap. Uses DATABASE_URL (or
 * PGLITE_DIR), the same database as the dev server; never an in-memory PGlite
 * the server holds. Prints the moved times, or why it was refused, with a
 * non-zero exit code.
 */
async function main(argv: string[]): Promise<number> {
  const parsed = parseAwayArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 2;
  }
  const config = loadConfig();
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    const result = await moveAway(handle.db, parsed.args);
    if (!result.ok) {
      console.error(result.message);
      return 1;
    }
    console.log(
      `${parsed.args.username}: ${result.stationId} now started ${result.startedAt.toISOString()}, last seen ${result.lastSeenAt.toISOString()}`,
    );
    return 0;
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
