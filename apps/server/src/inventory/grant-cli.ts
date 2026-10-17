import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { grantByUsername, parseGrantArgs } from './grant.js';
import { createInventory } from './inventory.js';

/**
 * pnpm --filter @iot/server inv:grant <username> <item> <qty> [place]
 * (in the server container: node dist/inventory/grant-cli.js <username> <item> <qty> [place]).
 * Uses DATABASE_URL (or PGLITE_DIR) like the server; see docs/design/inventory.md.
 */
const parsed = parseGrantArgs(process.argv.slice(2));
if (!parsed.ok) {
  console.error(parsed.message);
  process.exit(2);
}

const config = loadConfig();
const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
try {
  const result = await grantByUsername(handle.db, createInventory(handle.db), parsed.args);
  if (!result.ok) {
    console.error(`[inv:grant] refused: ${result.message}`);
    process.exitCode = 1;
  } else {
    const { entry } = result;
    console.log(
      `[inv:grant] ${parsed.args.username}: ${entry.delta > 0 ? '+' : ''}${entry.delta} ${entry.itemId} in the ${entry.place ?? ''}, now ${entry.balanceAfter} (ledger #${entry.id}, ${entry.reason}, ${entry.tellingId})`,
    );
  }
} finally {
  await handle.close();
}
