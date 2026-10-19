import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { moveAway, parseAwayArgs } from './away.js';

/**
 * pnpm --filter @iot/server holding:away <username> <hours>
 *
 * Moves the Kindled's clocks back `hours` (the active action's start and its
 * last heartbeat, the holding-wide last heartbeat and every basket cycle's
 * clock), as if it had been away that long: the next holding request settles
 * the stretch as offline time, up to the cap. Uses DATABASE_URL (or
 * PGLITE_DIR), the same database as the dev server; never an in-memory PGlite
 * the server holds. Prints the moved times and the away card waiting, if
 * one exists (M2 Task 7), or why it was refused, with a non-zero exit code.
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
    const a = result.activity;
    console.log(
      `${parsed.args.username}: ${a ? `${a.stationId} now started ${a.startedAt.toISOString()}, ` : 'no active action; '}last seen ${result.lastSeenAt?.toISOString() ?? 'never'}` +
        Object.entries(result.cycles)
          .map(([station, until]) => `, ${station} cycled until ${until.toISOString()}`)
          .join(''),
    );
    const card = result.card;
    console.log(
      card
        ? `away card: ${card.fromAt.toISOString()} to ${card.toAt.toISOString()}, made ${JSON.stringify(card.made)}, levels ${JSON.stringify(card.levels)}`
        : 'away card: none',
    );
    return 0;
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
