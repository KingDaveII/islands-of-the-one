import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { parseKeshResetArgs, resetKesh } from './kesh.js';

/**
 * pnpm --filter @iot/server kesh:reset <username>
 *
 * Clears Kesh's gifts for a Kindled (the first sliver and the last tide's),
 * so a playtest can see the first sliver again. Uses DATABASE_URL (or
 * PGLITE_DIR), the same database as the dev server; never an in-memory
 * PGlite the server holds. Nothing in the game calls it.
 */
async function main(argv: string[]): Promise<number> {
  const parsed = parseKeshResetArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.message);
    return 2;
  }
  const config = loadConfig();
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    const result = await resetKesh(handle.db, parsed.username);
    if (!result.ok) {
      console.error(result.message);
      return 1;
    }
    console.log(`${parsed.username}: Kesh's gifts cleared (the first sliver and the tide's are due again)`);
    return 0;
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
