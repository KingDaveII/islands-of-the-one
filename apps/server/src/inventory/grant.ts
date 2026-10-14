import { InventoryReason, isItemId, MAX_QUANTITY, validateUsername } from '@iot/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { accounts, kindled } from '../db/schema.js';
import type { Inventory, LedgerEntry } from './inventory.js';

/**
 * The playtest grant (docs/design/inventory.md): OPERATIONS gives or takes
 * items from a Kindled by account username, on the host. It goes through
 * inventory.apply with reason admin like any other change; there is no
 * player-facing way to grant items.
 */

export const GRANT_USAGE =
  'usage: inv:grant <username> <item> <qty>   (qty: a non-zero integer; negative takes away)';

export interface GrantArgs {
  username: string;
  itemId: string;
  quantity: number;
}

export function parseGrantArgs(
  argv: readonly string[],
): { ok: true; args: GrantArgs } | { ok: false; message: string } {
  // A `--` (as npm-style runners forward it) is not an argument.
  const rest = argv.filter((a) => a !== '--');
  if (rest.length !== 3) return { ok: false, message: GRANT_USAGE };
  const [rawUsername = '', itemId = '', rawQty = ''] = rest;
  const username = validateUsername(rawUsername);
  if (!username.ok) return { ok: false, message: `bad username: ${username.message}` };
  if (!isItemId(itemId))
    return { ok: false, message: `unknown item: ${rest[1] ?? ''} (see packages/shared/data/items.json)` };
  const quantity = /^-?\d+$/.test(rawQty) ? Number(rawQty) : NaN;
  if (!Number.isSafeInteger(quantity) || quantity === 0 || Math.abs(quantity) > MAX_QUANTITY)
    return { ok: false, message: `qty must be a non-zero integer: ${rawQty}` };
  return { ok: true, args: { username: username.value, itemId, quantity } };
}

export type GrantResult = { ok: true; entry: LedgerEntry } | { ok: false; message: string };

export async function grantByUsername(
  db: Database,
  inventory: Inventory,
  { username, itemId, quantity }: GrantArgs,
): Promise<GrantResult> {
  const [row] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, username.toLowerCase()))
    .limit(1);
  if (!row) return { ok: false, message: `no Kindled for username ${username}` };
  const result = await inventory.apply(
    [{ kindledId: row.kindledId, itemId, delta: quantity }],
    InventoryReason.Admin,
  );
  if (!result.ok) return { ok: false, message: result.message };
  const [entry] = result.entries;
  if (!entry) throw new Error('apply wrote no ledger row');
  return { ok: true, entry };
}
