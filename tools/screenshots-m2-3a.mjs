#!/usr/bin/env node
/**
 * M2 Task 3a end to end (docs/screenshots/m2-3a): the inventory screen with
 * its pack and store panes, driven through the mouse the way a player would.
 * A new account and Kindled see an empty screen; the playtest CLI grants
 * items (pnpm --filter @iot/server inv:grant, the same database as the dev
 * server) into the store, the pack and a basket; then the script clicks a
 * store cell (a stack to the pack), right-clicks a pack cell (one back to the
 * store), clicks a pack cell (a stack to the store), right-clicks a store
 * cell (one to the pack), checks each move through GET /api/inventory, fills
 * the pack to hit "Pack full.", and hovers a cell for the tooltip. Shots are
 * whole-page screenshots at 1280 × 720 (UI zoom 2).
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set:
 * the CLI and the server can't share an in-memory PGlite).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-3a.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-3a'));
const BASE = process.argv[3] ?? 'http://localhost:5173';

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
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));

const scenes = () =>
  page.evaluate(() => window.__iot?.game.scene.getScenes(true).map((s) => s.scene.key) ?? []);

async function waitScene(key) {
  for (let i = 0; i < 100; i++) {
    if ((await scenes()).includes(key)) return;
    await sleep(100);
  }
  throw new Error(`scene ${key} never started (active: ${(await scenes()).join(', ')})`);
}

async function shot(name) {
  await sleep(300);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

/** A layout point (UI px of the 480 × 270 menu layout) on the page (CSS px), through the scene's main camera. */
const toPage = (sceneKey, x, y) =>
  page.evaluate(
    ({ sceneKey, x, y }) => {
      const scene = window.__iot.game.scene.getScene(sceneKey);
      const cam = scene.cameras.main;
      const canvas = window.__iot.game.canvas;
      const r = canvas.getBoundingClientRect();
      const css = r.width / canvas.width;
      return {
        x: r.left + (cam.x + (x - cam.scrollX) * cam.zoom) * css,
        y: r.top + (cam.y + (y - cam.scrollY) * cam.zoom) * css,
      };
    },
    { sceneKey, x, y },
  );

/** Click a menu button by its label. */
async function clickButton(sceneKey, text) {
  const at = await page.evaluate(
    ({ sceneKey, text }) => {
      const scene = window.__iot.game.scene.getScene(sceneKey);
      const found = scene.children.list
        .filter((o) => o.type === 'Container')
        .flatMap((c) => c.list.map((child) => ({ c, child })))
        .find(({ child }) => child.text === text);
      if (!found) return null;
      const b = found.c.getBounds();
      return { x: b.centerX, y: b.centerY };
    },
    { sceneKey, text },
  );
  if (!at) throw new Error(`no ${text} button`);
  const p = await toPage(sceneKey, at.x, at.y);
  await page.mouse.click(p.x, p.y);
}

/** The centre of a cell of the inventory screen's pack or store grid, on the page. */
async function cell(pane, index) {
  const at = await page.evaluate(
    ({ pane, index }) => window.__iot.game.scene.getScene('inventory').cellAt(pane, index),
    { pane, index },
  );
  if (!at) throw new Error(`${pane} cell ${index} is off the grid`);
  return toPage('inventory', at.x + 12, at.y + 12);
}

const inventory = () => page.evaluate(async () => await (await fetch('/api/inventory')).json());
const moved = async () => {
  // The screen redraws from the answer; wait for the move's round trip.
  for (let i = 0; i < 50; i++) {
    if (!(await page.evaluate(() => window.__iot.game.scene.getScene('inventory').busy))) break;
    await sleep(50);
  }
  await sleep(100);
};
const status = () => page.evaluate(() => window.__iot.game.scene.getScene('inventory').status.text);
const expectInv = (inv, place, itemId, quantity) => {
  const got = inv[place].find((e) => e.itemId === itemId)?.quantity ?? 0;
  if (got !== quantity) throw new Error(`${place} ${itemId}: ${got}, expected ${quantity}`);
};

const username = `holder${Date.now() % 100000}`;
const grant = (...args) => {
  const out = execFileSync(
    'pnpm',
    ['--silent', '--filter', '@iot/server', 'inv:grant', username, ...args],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  console.log(`  ${out.trim()}`);
};

await page.goto(BASE);
await waitScene('account');
// Account and Kindled through the API (M2 Task 1 covers their screens).
const setup = await page.evaluate(async (username) => {
  const post = (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const reg = await post('/api/register', { username, password: 'correct horse battery' });
  const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
  return [reg.status, k.status];
}, username);
if (setup.join() !== '201,201') throw new Error(`setup failed: ${setup.join()}`);
await page.reload();
await waitScene('start');
await shot('01-start');
await page.keyboard.press('i');
await waitScene('inventory');
await shot('02-inventory-empty');

console.log('granting:');
grant('sealed-gin', '120');
grant('wild-sliver', '4');
grant('glass-chip', '2');
grant('deep-glass', '1');
grant('twisted-log', '5');
grant('black-stone', '130');
grant('streaked-stone', '6');
grant('grey-seeds', '12');
grant('pale-grain', '14', 'pack');
grant('pale-grain', '9', 'basket:field');
try {
  grant('sealed-gin', '1', 'pack');
  throw new Error('a grant of currency into the pack went through');
} catch (e) {
  if (!String(e.stderr).includes('purse')) throw e;
  console.log('  currency into the pack: refused');
}

await page.keyboard.press('Escape');
await waitScene('start');
await clickButton('start', 'INVENTORY');
await waitScene('inventory');
await shot('03-inventory-granted');
let inv = await inventory();
expectInv(inv, 'purse', 'sealed-gin', 120);
expectInv(inv, 'pack', 'pale-grain', 14);
expectInv(inv, 'store', 'black-stone', 130);
if (inv.baskets.field?.[0]?.quantity !== 9) throw new Error('the basket is missing');

// Store cells (all tab): slivers 4, humming 2, deep 1, logs 5, stone 50, stone 50, stone 30, streaked 6, seeds 12.
console.log('moving:');
let at = await cell('store', 4);
await page.mouse.click(at.x, at.y);
await moved();
inv = await inventory();
expectInv(inv, 'pack', 'black-stone', 50);
expectInv(inv, 'store', 'black-stone', 80);
console.log('  click: 50 black stone, store -> pack');
await shot('04-stack-to-pack');

// Pack cells (items.json order): stone 50, grain 14. Right-click the stone: one back.
at = await cell('pack', 0);
await page.mouse.click(at.x, at.y, { button: 'right' });
await moved();
inv = await inventory();
expectInv(inv, 'pack', 'black-stone', 49);
expectInv(inv, 'store', 'black-stone', 81);
console.log('  right-click: 1 black stone, pack -> store');
await shot('05-one-to-store');

// Click the grain: its stack to the store.
at = await cell('pack', 1);
await page.mouse.click(at.x, at.y);
await moved();
inv = await inventory();
expectInv(inv, 'pack', 'pale-grain', 0);
expectInv(inv, 'store', 'pale-grain', 14);
console.log('  click: 14 pale grain, pack -> store');

// Right-click the store's slivers: one to the pack.
at = await cell('store', 0);
await page.mouse.click(at.x, at.y, { button: 'right' });
await moved();
inv = await inventory();
expectInv(inv, 'pack', 'wild-sliver', 1);
expectInv(inv, 'store', 'wild-sliver', 3);
console.log('  right-click: 1 wild sliver, store -> pack');
await shot('06-one-to-pack');

// Drag the pack's slivers onto the store.
at = await cell('pack', 0);
const storeAt = await cell('store', 8);
await page.mouse.move(at.x, at.y);
await page.mouse.down();
await page.mouse.move(storeAt.x, storeAt.y, { steps: 8 });
await page.mouse.up();
await moved();
inv = await inventory();
expectInv(inv, 'pack', 'wild-sliver', 0);
expectInv(inv, 'store', 'wild-sliver', 4);
console.log('  drag: 1 wild sliver, pack -> store');

// Fill the pack: 19 slots of stone beside the 49 (one slot) make 20; the next cell is refused.
grant('black-stone', '950', 'pack');
await page.keyboard.press('i');
await waitScene('start');
await page.keyboard.press('i');
await waitScene('inventory');
at = await cell('store', 0);
await page.mouse.click(at.x, at.y);
await moved();
if ((await status()) !== 'Pack full.')
  throw new Error(`expected "Pack full.", got "${await status()}"`);
inv = await inventory();
expectInv(inv, 'store', 'wild-sliver', 4);
console.log('  click with a full pack: "Pack full."');
await shot('07-pack-full');

// The tooltip, on hover.
at = await cell('pack', 0);
await page.mouse.move(at.x, at.y);
await sleep(200);
await shot('08-tooltip');

// The tabs.
const tab = await page.evaluate(() => {
  const scene = window.__iot.game.scene.getScene('inventory');
  const t = scene.tabTexts.find((x) => x.text === 'SPARKGLASS');
  return { x: t.x + t.width / 2, y: t.y + 4 };
});
const tabAt = await toPage('inventory', tab.x, tab.y);
await page.mouse.click(tabAt.x, tabAt.y);
await page.mouse.move(tabAt.x, tabAt.y + 200);
await shot('09-tab-sparkglass');

console.log(`GET /api/inventory: ${JSON.stringify(inv)}`);
await browser.close();
