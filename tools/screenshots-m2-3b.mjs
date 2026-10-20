#!/usr/bin/env node
/**
 * M2 Task 3b end to end (docs/screenshots/m2-3b), re-shot for 3c: the
 * holding. A new account and Kindled log in and land on the holding from the
 * start screen; the Kindled walks (a walk, then the automatic run), goes to
 * the nearest twisted tree, uses it and works there for a few cycles (the
 * chip with its ring, the "+1" floaters), takes all (the "+2" float, no
 * line), opens the inventory over the holding and moves the logs to the pack,
 * then reloads and sees the counts kept and the action still running. Then
 * the away hook (`pnpm --filter @iot/server holding:away`, the same database
 * as the dev server) moves the action 60 h back, and the next request settles
 * 48 h of it: the basket holds the cap's worth. Then the store filled with
 * logs by the grant CLI gives "Store: twisted logs full." on a take-all.
 * Last, the shore (3c): the south shore dropping into the Hollow at the
 * landing, the north edge's lip, and the Kindled behind the tall tree's
 * canopy. Every count is checked through the API. Shots are whole-page
 * screenshots at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-3b.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-3b'));
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

const scenes = () => page.evaluate(() => window.__iot?.game.scene.getScenes(true).map((s) => s.scene.key) ?? []);

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

const holding = () => page.evaluate(() => window.__iot.holding());
const api = (route) => page.evaluate(async (route) => await (await fetch(route)).json(), route);

/** Waits until the holding scene's latest server answer satisfies `pred`. */
async function until(pred, what, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const h = await holding();
    if (h && pred(h)) return h;
    await sleep(100);
  }
  throw new Error(`never: ${what}`);
}

/** A layout point (UI px) on the page (CSS px), through a scene's main camera. */
const toPage = (sceneKey, x, y) =>
  page.evaluate(
    ({ sceneKey, x, y }) => {
      const scene = window.__iot.game.scene.getScene(sceneKey);
      const cam = scene.cameras.main;
      const canvas = window.__iot.game.canvas;
      const r = canvas.getBoundingClientRect();
      const css = r.width / canvas.width;
      return { x: r.left + (cam.x + (x - cam.scrollX) * cam.zoom) * css, y: r.top + (cam.y + (y - cam.scrollY) * cam.zoom) * css };
    },
    { sceneKey, x, y },
  );

/** A point of the holding's UI camera (UI px) on the page: the UI camera is the second camera, at zU over the whole canvas. */
const uiToPage = (x, y) =>
  page.evaluate(
    ({ x, y }) => {
      const scene = window.__iot.holdingScene();
      const cam = scene.cameras.cameras[1];
      const canvas = window.__iot.game.canvas;
      const r = canvas.getBoundingClientRect();
      const css = r.width / canvas.width;
      return { x: r.left + x * cam.zoom * css, y: r.top + y * cam.zoom * css };
    },
    { x, y },
  );

/** Click a button by its label in a scene (the holding's buttons are on its UI camera). */
async function clickButton(sceneKey, text) {
  const at = await page.evaluate(
    ({ sceneKey, text }) => {
      const scene = window.__iot.game.scene.getScene(sceneKey);
      // The holding keeps its UI in a Layer: look inside layers too.
      const objects = scene.children.list.flatMap((o) => (o.type === 'Layer' ? o.list : [o]));
      const found = objects
        .filter((o) => o.type === 'Container')
        .flatMap((c) => c.list.map((child) => ({ c, child })))
        .find(({ child }) => child.text === text);
      if (!found) return null;
      const b = found.c.getBounds();
      return { x: b.centerX, y: b.centerY };
    },
    { sceneKey, text },
  );
  if (!at) throw new Error(`no ${text} button in ${sceneKey}`);
  const p = sceneKey === 'holding' ? await uiToPage(at.x, at.y) : await toPage(sceneKey, at.x, at.y);
  await page.mouse.click(p.x, p.y);
}

/** Steer the Kindled to a point (sim px) with the roam's own scripted input, then let the controls back in. */
async function walkTo(x, y) {
  await page.evaluate(
    ({ x, y }) => {
      const s = window.__iot.holdingScene().session;
      s.inputSource = (state) => {
        const dx = x - state.x / 256;
        const dy = y - state.y / 256;
        if (Math.hypot(dx, dy) < 3) return 0;
        const dir = Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * 256) & 255;
        return ((dir & 0xff) << 12) | (7 << 20);
      };
    },
    { x, y },
  );
  for (let i = 0; i < 200; i++) {
    const h = await holding();
    if (Math.hypot(h.state.x - x, h.state.y - y) < 4) break;
    await sleep(50);
  }
  await page.evaluate(() => {
    window.__iot.holdingScene().session.inputSource = null;
  });
  await sleep(200);
}

const username = `holder${Date.now() % 100000}`;
const cli = (script, ...args) => {
  const out = execFileSync('pnpm', ['--silent', '--filter', '@iot/server', script, username, ...args], { cwd: ROOT, encoding: 'utf8' });
  console.log(`  ${out.trim()}`);
};
const expectEq = (what, got, want) => {
  if (got !== want) throw new Error(`${what}: ${got}, expected ${want}`);
};

/** The layout's points the run walks to (sim px), from the data, so a layout edit moves the run with it. */
const layout = await (async () => {
  const data = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8'));
  return data.layouts[0];
})();
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const station = (id) => layout.stations.find((s) => s.id === id);
const start = (() => {
  const r = layout.tiles.findIndex((row) => row.includes('P'));
  return { col: layout.tiles[r].indexOf('P'), row: r };
})();
// The tree nearest the start, by its interact point.
const treePart = station('twisted-trees').parts.reduce((best, p) =>
  !best || Math.hypot(p.interact.col - start.col, p.interact.row - start.row) < Math.hypot(best.interact.col - start.col, best.interact.row - start.row) ? p : best, null);
const treeUse = centre(treePart.interact);
console.log(`the tree's interact point: (${treePart.interact.col}, ${treePart.interact.row}) = (${treeUse.x}, ${treeUse.y}) sim px`);

await page.goto(BASE);
await waitScene('account');
// 1. The account and Kindled through the API (M2 Task 1 covers their screens), then the start screen's main action.
const setup = await page.evaluate(async (username) => {
  const post = (url, body) =>
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const reg = await post('/api/register', { username, password: 'correct horse battery' });
  const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
  return [reg.status, k.status];
}, username);
if (setup.join() !== '201,201') throw new Error(`setup failed: ${setup.join()}`);
await page.reload();
await waitScene('start');
await shot('01-start');
await page.keyboard.press('Enter');
await waitScene('holding');
await until((h) => h.response !== null, 'the holding answered');
await shot('02-holding');
let h = await holding();
expectEq('layout', h.response.layoutId, 'first-holding');
expectEq('activity', h.response.activity, null);

// 2. Walking: a walk, then the automatic run after 1.2 s of moving the same way. Measured in sim ticks (60 Hz), not
// wall time: a headless browser on software GL runs the sim slower than real time when its frames are slow.
console.log('walking:');
const tick0 = (await holding()).state.tick;
await page.keyboard.down('KeyD');
h = await until((x) => x.state.tick - tick0 >= 36, '0.6 s of walking');
expectEq('gait after 0.6 s', h.state.gait, 'walk');
console.log(`  walk: ${h.pose}`);
await shot('03-walk');
h = await until((x) => x.state.tick - tick0 >= 120, '2 s of moving');
expectEq('gait after 2 s', h.state.gait, 'run');
console.log(`  run: ${h.pose}`);
await shot('04-run');
await page.keyboard.up('KeyD');
await sleep(300);
h = await holding();
expectEq('stopped', h.state.gait, 'walk');

// 3. The trees: walk to the nearest tree's interact point, Use, Work here, a few cycles.
console.log('working the trees:');
await walkTo(treeUse.x, treeUse.y);
await until((x) => x.prompt, 'the USE prompt');
await shot('05-prompt');
await page.keyboard.press('KeyE');
await until((x) => x.panel === 'twisted-trees', 'the station panel');
await shot('06-station-panel');
await clickButton('holding', 'WORK HERE');
await until((x) => x.response?.activity?.stationId === 'twisted-trees', 'the action started');
await page.keyboard.press('Escape');
await until((x) => x.panel === null, 'the panel closed');
await sleep(4300);
await shot('07-working');
await sleep(4000);
h = await holding();
console.log(`  chip: ${JSON.stringify(h.chip)}`);
let r = await api('/api/holding');
expectEq('basket after two cycles', r.baskets['twisted-trees'][0]?.quantity, 2);
expectEq('woodcutting xp', r.skills.woodcutting.xp, 8);
await shot('08-two-cycles');

// 4. Take all: "+2" floats over the tree, the panel shows no line (GAME DESIGN 2026-10-18).
await page.keyboard.press('KeyE');
await until((x) => x.panel === 'twisted-trees', 'the station panel again');
await clickButton('holding', 'TAKE ALL');
h = await until((x) => x.floats.some((f) => f.startsWith('+')), 'the take-all float');
console.log(`  take all: float "${h.floats.join(' ')}", line "${h.result}"`);
expectEq('no take-all line', h.result, '');
await shot('09-take-all');
r = await api('/api/inventory');
const logsInStore = r.store.find((e) => e.itemId === 'twisted-log')?.quantity ?? 0;
if (logsInStore < 2) throw new Error(`store has ${logsInStore} logs, expected at least 2`);
await page.keyboard.press('Escape');
await until((x) => x.panel === null, 'the panel closed');

// 5. The inventory over the holding: the logs from the store to the pack, then back to the holding.
await page.keyboard.press('KeyI');
await waitScene('inventory');
await sleep(500);
await shot('10-inventory');
const cell = await page.evaluate(() => window.__iot.game.scene.getScene('inventory').cellAt('store', 0));
const at = await toPage('inventory', cell.x + 12, cell.y + 12);
await page.mouse.click(at.x, at.y);
for (let i = 0; i < 50; i++) {
  if (!(await page.evaluate(() => window.__iot.game.scene.getScene('inventory').busy))) break;
  await sleep(50);
}
await sleep(200);
r = await api('/api/inventory');
expectEq('logs in the pack', r.pack.find((e) => e.itemId === 'twisted-log')?.quantity, logsInStore);
console.log(`  moved ${logsInStore} logs to the pack`);
await shot('11-logs-in-pack');
await page.keyboard.press('Escape');
await waitScene('holding');
await sleep(300);

// 6. A reload keeps the counts and the action.
await page.reload();
await waitScene('start');
await page.keyboard.press('Enter');
await waitScene('holding');
h = await until((x) => x.response !== null, 'the holding answered after the reload');
expectEq('still working after the reload', h.response.activity?.stationId, 'twisted-trees');
r = await api('/api/inventory');
expectEq('pack kept', r.pack.find((e) => e.itemId === 'twisted-log')?.quantity, logsInStore);
console.log(`  reload: pack ${r.pack.map((e) => `${e.itemId} ${e.quantity}`).join(', ')}; working ${h.response.activity.stationId}`);
await shot('12-reloaded');

// The away hook: 60 h back; the next request settles 48 h of it (43,200 cycles of 4 s), the rest is lost.
console.log('away:');
cli('holding:away', '60');
r = await api('/api/holding');
const basket = r.baskets['twisted-trees'][0]?.quantity ?? 0;
// The cap's worth of cycles (48 h of 4 s) and of the trees' own trickle (Task 5: the station's `cycle`, 48 h of it),
// plus the few seconds the stretch ran before the shift and what the basket held; never the 60 h.
const treesDef = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/stations.json'), 'utf8')).stations.find(
  (s) => s.id === 'twisted-trees',
);
const trickle = treesDef.cycle ? Math.floor((48 * 3600 * 1000) / treesDef.cycle.cycleMs) * treesDef.cycle.quantity : 0;
const cap = (48 * 3600) / 4 + trickle;
if (basket < cap || basket > cap + 20) throw new Error(`the basket after 60 h away: ${basket}, expected about ${cap}`);
console.log(`  basket after 60 h away: ${basket} logs (the 48 h cap), xp ${r.skills.woodcutting.xp}, level ${r.skills.woodcutting.level}`);
await walkTo(treeUse.x, treeUse.y);
await page.keyboard.press('KeyE');
await until((x) => x.panel === 'twisted-trees' && x.response?.baskets['twisted-trees'][0]?.quantity >= basket, 'the panel with the away basket');
await shot('13-away-basket');

// The full store: 9,999 logs in the store, a take-all leaves the basket and says so.
const inv = await api('/api/inventory');
cli('inv:grant', 'twisted-log', String(9999 - (inv.store.find((e) => e.itemId === 'twisted-log')?.quantity ?? 0)));
await clickButton('holding', 'TAKE ALL');
// "Store: twisted logs full." is a toast since Task 7, no longer the panel's line.
h = await until((x) => x.toasts?.lines.some((l) => l.startsWith('Store:')), 'the store-full toast');
console.log(`  take all with a full store: "${h.toasts.lines.find((l) => l.startsWith('Store:'))}"`);
await shot('14-store-full');
r = await api('/api/inventory');
expectEq('store full', r.store.find((e) => e.itemId === 'twisted-log')?.quantity, 9999);
await page.keyboard.press('Escape');
await until((x) => x.panel === null, 'the panel closed');

// The shore (3c): the south shore at the landing, the north edge's lip, and the Kindled behind the tall tree.
console.log('the shore:');
const landing = centre(layout.landing);
await walkTo(landing.x, landing.y);
await shot('15-south-shore');
// Up the path west of the post (the post itself stands in the start's column) to the north edge, row 1.
const path = centre({ col: start.col - 1, row: start.row });
await walkTo(path.x, path.y);
const north = centre({ col: start.col - 1, row: 1 });
await walkTo(north.x, north.y);
h = await holding();
if (Math.abs(h.state.y - north.y) > 8) throw new Error(`the Kindled did not reach the north edge: at (${h.state.x}, ${h.state.y}), wanted (${north.x}, ${north.y})`);
await shot('16-north-lip');
// North of the tree the run worked: its feet above the tree's base, so the canopy draws over it.
const behind = centre({ col: treePart.rect.col + 1, row: treePart.rect.row - 1 });
await walkTo(behind.x, behind.y - 2);
h = await holding();
const tree = h.props.find((p) => p.stationId === 'twisted-trees' && p.y === (treePart.rect.row + treePart.rect.rows) * 32);
if (!tree) throw new Error('no prop for the tree');
if (!(h.playerDepth < tree.depth)) throw new Error(`the Kindled (depth ${h.playerDepth}) is not behind the tree (depth ${tree.depth})`);
console.log(`  behind the tree: Kindled depth ${h.playerDepth}, tree depth ${tree.depth}`);
await shot('17-behind-tree');

await browser.close();
