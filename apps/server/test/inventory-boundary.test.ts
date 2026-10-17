import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * "Nothing else touches item tables" (CLAUDE.md, docs/design/inventory.md):
 * outside apps/server/src/inventory, no server source or test imports the
 * table objects (ESLint enforces it too) or names the tables in raw SQL.
 */
const root = fileURLToPath(new URL('..', import.meta.url));
const INVENTORY_DIR = join('src', 'inventory');
const SELF = relative(root, fileURLToPath(import.meta.url));
/** Seeds the retired `items` table the way Task 2 did, to check migration 0003 copies it. */
const MIGRATION_TEST = join('test', 'inventory-migration.test.ts');

/** Built so that this file doesn't match itself. */
const TABLES_IMPORT = new RegExp(['inventory', 'tables'].join('/'));
const LEDGER_NAME = new RegExp(['item', 'ledger'].join('_'));
const STACKS_NAME = new RegExp(['item', 'stacks'].join('_'));
const ITEMS_SQL = /\b(from|into|update|join|table)\s+"?items"?(\s|$|;|\))/i;

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return e.name.endsWith('.ts') ? [path] : [];
  });
}

describe('item tables boundary', () => {
  it('the patterns catch an import and raw SQL', () => {
    expect(TABLES_IMPORT.test(`import { items } from '../inventory/tables.js';`)).toBe(true);
    expect(ITEMS_SQL.test('sql`update items set quantity = 0`')).toBe(true);
    expect(ITEMS_SQL.test('select * from "items";')).toBe(true);
    expect(LEDGER_NAME.test('delete from item_ledger')).toBe(true);
    expect(STACKS_NAME.test(`sql\`select * from item_stacks\``)).toBe(true);
    expect(ITEMS_SQL.test('the inventory lists items for a Kindled')).toBe(false);
  });

  it('only the inventory module imports the tables or names them in SQL', () => {
    const files = [...sources('src'), ...sources('test')].filter(
      (f) => !f.startsWith(INVENTORY_DIR) && f !== SELF && f !== MIGRATION_TEST,
    );
    expect(files.length).toBeGreaterThan(10);
    const hits: string[] = [];
    for (const file of files) {
      for (const [i, line] of readFileSync(join(root, file), 'utf8').split('\n').entries()) {
        if (
          TABLES_IMPORT.test(line) ||
          LEDGER_NAME.test(line) ||
          STACKS_NAME.test(line) ||
          ITEMS_SQL.test(line)
        )
          hits.push(`${file}:${i + 1}: ${line.trim()}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
