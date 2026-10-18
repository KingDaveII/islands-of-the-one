import { toWritView } from '@iot/shared';
import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { writStored } from './writ.js';
import { parseWritSetArgs, setWrit } from './writ-set.js';

/**
 * pnpm --filter @iot/server writ:set <username> [--charge-hours N] [--dark-hours N] [--certified on|off]
 *
 * Sets the Kindled's Writ for a playtest: lit, flickering, dark or fading
 * without waiting days. Uses DATABASE_URL (or PGLITE_DIR), the same database
 * as the dev server; never an in-memory PGlite the server holds. Prints the
 * Writ's state, or why it was refused, with a non-zero exit code.
 */
async function main(argv: string[]): Promise<number> {
  const parsed = parseWritSetArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 2;
  }
  const config = loadConfig();
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    const now = new Date();
    const result = await setWrit(handle.db, parsed.args, now);
    if (!result.ok) {
      console.error(result.message);
      return 1;
    }
    const view = toWritView(writStored(result.writ), now.getTime());
    console.log(
      `${parsed.args.username}: Writ ${view.state}, ${view.words} (empty ${view.emptyAt}, ${view.certified ? 'certified' : 'not certified'}, name ${view.name ?? 'none'})`,
    );
    return 0;
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
