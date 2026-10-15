#!/usr/bin/env node
/**
 * Historical (M1/M2): this script assumes M1's 480 × 270 canvas at a CSS
 * zoom. Since G1.5 (the canvas at device resolution, a world and a UI camera)
 * it no longer runs as-is; its shots stay the record of their task.
 * tools/screenshots-g15.mjs is the current script.
 *
 * The inventory view (docs/screenshots/m2-task2), and the M2 Task 2
 * end-to-end check: a new account and Kindled see an empty inventory; the
 * playtest CLI grants items (pnpm --filter @iot/server inv:grant, the same
 * database as the dev server); after a reload the start screen's INVENTORY
 * button shows them. Needs the dev stack running on Postgres (`pnpm dev`
 * with DATABASE_URL set: the CLI and the server can't share an in-memory
 * PGlite); the shots are game pixels at zoom 3.
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-task2.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-task2'));
const BASE = process.argv[3] ?? 'http://localhost:5173';
const ZOOM = 3;

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith('chromium-')) continue;
    for (const candidate of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
      const p = join(base, dir, candidate);
      if (existsSync(p)) return p;
    }
  }
  throw new Error('no Chromium found: set CHROMIUM_PATH');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const context = await browser.newContext({
  viewport: { width: 480 * ZOOM, height: 270 * ZOOM },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));

const scenes = () =>
  page.evaluate(() => window.__iot.game.scene.getScenes(true).map((s) => s.scene.key));

async function waitScene(key) {
  for (let i = 0; i < 100; i++) {
    if ((await scenes()).includes(key)) return;
    await sleep(100);
  }
  throw new Error(`scene ${key} never started (active: ${(await scenes()).join(', ')})`);
}

async function shot(name) {
  await sleep(300);
  await page.locator('#game canvas').screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

/** Click the start screen's INVENTORY button (game px → page px). */
async function openInventory() {
  await waitScene('start');
  const at = await page.evaluate(() => {
    const scene = window.__iot.game.scene.getScene('start');
    const text = scene.children.list
      .filter((o) => o.type === 'Container')
      .flatMap((c) => c.list.map((child) => ({ c, child })))
      .find(({ child }) => child.text === 'INVENTORY');
    if (!text) return null;
    const b = text.c.getBounds();
    return { x: b.centerX, y: b.centerY };
  });
  if (!at) throw new Error('no INVENTORY button');
  const box = await page.locator('#game canvas').boundingBox();
  await page.mouse.click(box.x + at.x * (box.width / 480), box.y + at.y * (box.height / 270));
  await waitScene('inventory');
}

const username = `holder${Date.now() % 100000}`;
const grant = (...args) => {
  const out = execFileSync('pnpm', ['--silent', '--filter', '@iot/server', 'inv:grant', username, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  console.log(`  ${out.trim()}`);
};

await page.goto(BASE);
await waitScene('account');
// Account and Kindled through the API (M2 Task 1 covers their screens).
const status = await page.evaluate(async (username) => {
  const post = (url, body) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const reg = await post('/api/register', { username, password: 'correct horse battery' });
  const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
  return [reg.status, k.status];
}, username);
if (status.join() !== '201,201') throw new Error(`setup failed: ${status.join()}`);
await page.reload();
await shot('01-start');
await openInventory();
await shot('02-inventory-empty');

console.log('granting:');
grant('sealed-gin', '120');
grant('wild-sliver', '4');
grant('glass-chip', '2');
grant('deep-glass', '1');
grant('twisted-log', '5');
grant('black-stone', '30');
grant('streaked-stone', '6');
grant('grey-seeds', '12');
grant('pale-grain', '14');
grant('grey-seeds', '-12');
try {
  grant('twisted-log', '10000');
  throw new Error('a grant past the stack limit went through');
} catch (e) {
  if (!String(e.stderr).includes('limit')) throw e;
  console.log('  past the stack limit: refused');
}

await page.reload();
await openInventory();
await shot('03-inventory-granted');
const items = await page.evaluate(async () => (await (await fetch('/api/inventory')).json()).items);
console.log(`GET /api/inventory: ${items.map((i) => `${i.quantity} ${i.item}`).join(', ')}`);
if (items.length !== 8 || items.some((i) => i.item === 'grey-seeds')) throw new Error('unexpected inventory');

await browser.close();
