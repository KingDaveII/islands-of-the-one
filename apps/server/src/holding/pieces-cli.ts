import { holdingLayout, pieceDef } from '@iot/shared';
import { loadConfig } from '../config.js';
import { createDb } from '../db/client.js';
import { createInventory } from '../inventory/index.js';
import { createHolding } from './holding.js';
import { listPieces, parsePiecesArgs } from './pieces.js';

/**
 * pnpm --filter @iot/server plots:pieces <username> <plotId> [--clear]
 *
 * Lists the upgrade pieces standing in a Kindled's plot (docs/design/holding.md
 * "Build mode"); with --clear, takes them all down with their refunds into
 * the store (which may overfill it), as a holding request, so a playtest can
 * start a plot over. Uses DATABASE_URL (or PGLITE_DIR), the same database as
 * the dev server; never an in-memory PGlite the server holds. Nothing in the
 * game calls it.
 */
async function main(argv: string[]): Promise<number> {
  const parsed = parsePiecesArgs(argv, holdingLayout());
  if (!parsed.ok) {
    console.error(parsed.message);
    return 2;
  }
  const { username, plotId, clear } = parsed.args;
  const config = loadConfig();
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  try {
    const listed = await listPieces(handle.db, { username, plotId });
    if (!listed.ok) {
      console.error(listed.message);
      return 1;
    }
    const words = listed.pieces.map((p) => `${pieceDef(p.pieceId)?.name ?? p.pieceId} at (${p.col}, ${p.row}) turned ${p.rotation}`);
    console.log(`${username} ${plotId}: ${words.length ? words.join('; ') : 'no pieces'}`);
    if (!clear) return 0;
    const holding = createHolding(handle.db, createInventory(handle.db));
    const cleared = await holding.clearPieces(listed.kindledId, plotId, new Date());
    if (!cleared.ok) {
      console.error(cleared.message);
      return 1;
    }
    const refund = cleared.value.refund.map((r) => `+${r.quantity} ${r.itemId}`).join(', ');
    console.log(`${username} ${plotId}: cleared${refund ? `; the store got ${refund}` : ''}`);
    return 0;
  } finally {
    await handle.close();
  }
}

process.exitCode = await main(process.argv.slice(2));
