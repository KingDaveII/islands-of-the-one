#!/usr/bin/env node
/**
 * M2 Task 7 end to end (docs/screenshots/m2-7): sleep, the While you were
 * away card and the toasts. A new account and Kindled name the island
 * (through the API, as Task 4a's run showed it), name and sow an Old field
 * (אדמה · ישן, as Task 5's run did) and land on the holding working the
 * trees. The Writ panel shows SLEEP and its hint; SLEEP sits the Kindled
 * against the post, then cuts to the sleep screen, which logs out onto the
 * start screen. Logged in again after `holding:away … 7`, the away card
 * opens: the time away, the Field and Trees lines, the skills line and the
 * Writ; any key closes it and the row is gone on the server. Then the
 * toasts: a level-up from working the outcrop, "Store: twisted logs full."
 * stacked under "Your Writ has about a day left." (two at most, the newest
 * at the bottom), "Pack full." over the open inventory, "Your Writ has about
 * a day left." on landing after `writ:set --charge-hours 23` and a reload
 * (and not again on a second reload), and after `writ:set --dark-hours 49`
 * and `holding:away`, the card's faded Writ line.
 * Every state is checked through the API and the scene's snapshot (`away`,
 * `toasts`, `sleeping` on `window.__iot`). Shots are whole-page screenshots
 * at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-7.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-7'));
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

async function waitScene(key, tries = 100) {
  for (let i = 0; i < tries; i++) {
    if ((await scenes()).includes(key)) return;
    await sleep(100);
  }
  throw new Error(`scene ${key} never started (active: ${(await scenes()).join(', ')})`);
}

async function shot(name, settle = 300) {
  await sleep(settle);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

const holding = () => page.evaluate(() => window.__iot.holding());
const toasts = () => page.evaluate(() => window.__iot.toasts());
const sleeping = () => page.evaluate(() => window.__iot.sleeping());
const api = (route, body) =>
  page.evaluate(
    async ({ route, body }) => {
      const res = await fetch(route, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
      const text = await res.text();
      return { status: res.status, body: text === '' ? null : JSON.parse(text) };
    },
    { route, body },
  );

/** Waits until the holding scene's snapshot satisfies `pred`. */
async function until(pred, what, tries = 100, every = 100) {
  for (let i = 0; i < tries; i++) {
    const h = await holding();
    if (h && pred(h)) return h;
    await sleep(every);
  }
  const last = await holding();
  const seen = last
    ? { prompt: last.promptLabel, panel: last.panel, writPanel: last.writPanel && { state: last.writPanel.state, focus: last.writPanel.focus }, away: last.away, toasts: last.toasts.lines, at: [last.state.x, last.state.y] }
    : { scenes: await scenes() };
  throw new Error(`never: ${what} (${JSON.stringify(seen)})`);
}

/** Waits until a predicate over any page state holds. */
async function untilTrue(fn, what, tries = 100, every = 100) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  throw new Error(`never: ${what}`);
}

/** A point of the holding's UI camera (UI px) on the page. */
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

/** A point of a menu scene's main camera on the page (the inventory). */
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

/** Click a button by its label on the holding's UI camera. */
async function clickButton(text) {
  const at = await page.evaluate((text) => {
    const scene = window.__iot.holdingScene();
    const objects = scene.children.list.flatMap((o) => (o.type === 'Layer' ? o.list : [o]));
    const found = objects
      .filter((o) => o.type === 'Container' && o.visible)
      .flatMap((c) => c.list.map((child) => ({ c, child })))
      .find(({ child }) => child.text === text);
    if (!found) return null;
    const b = found.c.getBounds();
    return { x: b.centerX, y: b.centerY };
  }, text);
  if (!at) throw new Error(`no ${text} button`);
  const p = await uiToPage(at.x, at.y);
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
  for (let i = 0; i < 300; i++) {
    const h = await holding();
    if (Math.hypot(h.state.x - x, h.state.y - y) < 4) break;
    await sleep(50);
  }
  await page.evaluate(() => {
    window.__iot.holdingScene().session.inputSource = null;
  });
  await sleep(200);
}

const username = `sleep${Date.now() % 100000}`;
const password = 'correct horse battery';
const cli = (script, ...args) => {
  const out = execFileSync('pnpm', ['--silent', '--filter', '@iot/server', script, '--', username, ...args], { cwd: ROOT, encoding: 'utf8' });
  console.log(`  ${out.trim().replaceAll('\n', '\n  ')}`);
  return out;
};
const expectEq = (what, got, want) => {
  if (got !== want) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
const expectMatch = (what, got, re) => {
  if (!re.test(got)) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${re}`);
};
const refresh = () =>
  page.evaluate(() => {
    window.__iot.holdingScene().refresh();
  });

/** The layout's points (sim px), from the data. */
const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8')).layouts[0];
const inventoryData = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/inventory.json'), 'utf8'));
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const station = (id) => layout.stations.find((s) => s.id === id);
const postUse = centre(station('writ-post').parts[0].interact);
const outcropUse = centre(station('stone-outcrop').parts[0].interact);
const start = (() => {
  const r = layout.tiles.findIndex((row) => row.includes('P'));
  return { col: layout.tiles[r].indexOf('P'), row: r };
})();
const treePart = station('twisted-trees').parts.reduce(
  (best, p) =>
    !best || Math.hypot(p.interact.col - start.col, p.interact.row - start.row) < Math.hypot(best.interact.col - start.col, best.interact.row - start.row) ? p : best,
  null,
);
const treeUse = centre(treePart.interact);

/** Use at a point: walk there, wait for the prompt, press E. */
async function useAt(at, what) {
  await walkTo(at.x, at.y);
  await until((x) => x.promptLabel === 'USE', `the USE prompt at ${what}`);
  await page.keyboard.press('KeyE');
}

/** Log in and land on the holding (a reload, the start screen's main action). */
async function land() {
  await page.reload();
  await waitScene('start');
  await page.keyboard.press('Enter');
  await waitScene('holding');
  return until((x) => x.response !== null, 'the holding answered');
}

await page.goto(BASE);
await waitScene('account');
const setup = await page.evaluate(
  async ({ username, password }) => {
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const reg = await post('/api/register', { username, password });
    const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
    const name = await post('/api/writ/name', { name: 'Black Rock' });
    const word = await post('/api/kesh/word', {});
    return [reg.status, k.status, name.status, word.status];
  },
  { username, password },
);
if (setup.join() !== '201,201,200,200') throw new Error(`setup failed: ${setup.join()}`);
// An Old field (אדמה · ישן): ישן granted, the plot named with both tiles, Kesh's seeds, sown; then the trees worked.
cli('words:grant', 'yashan');
const field = await page.evaluate(async () => {
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const plot = await post('/api/plots/name', { plotId: 'plot-1', ground: 'adamah', virtue: 'yashan' });
  const seeds = await post('/api/kesh/seeds', {});
  const sown = await post('/api/plots/sow', { plotId: 'plot-1' });
  const work = await post('/api/holding/work', { stationId: 'twisted-trees' });
  return [plot.status, seeds.status, sown.status, work.status];
});
if (field.join() !== '200,200,200,200') throw new Error(`the field failed: ${field.join()}`);
let h = await land();
expectEq('no card on a fresh holding', h.response.away, null);
expectEq('working the trees', h.response.activity?.stationId, 'twisted-trees');

// 1. The Writ panel with SLEEP and its hint, the last item in the focus order.
console.log('the Writ panel:');
await useAt(postUse, 'the post');
h = await until((x) => x.writPanel !== null && x.writPanel.state !== '', 'the Writ panel');
expectEq('SLEEP on the panel', h.writPanel.sleep, 'SLEEP');
expectEq('the hint under it', h.writPanel.sleepHint, 'Lie down to sleep and leave the game. Your holding keeps working while you sleep, until the Writ runs low.');
// Up from the first kind wraps to the last item: SLEEP.
await page.keyboard.press('ArrowUp');
await until((x) => x.writPanel?.focus === 'sleep', 'SLEEP focused last in the order');
await shot('01-writ-panel-sleep');

// 2. SLEEP: the Kindled's moment against the post (the sit row when the sheet has it, else idle, facing it), then the
// cut to the sleep screen, one line, no fade.
console.log('sleep:');
await clickButton('SLEEP');
h = await until((x) => x.sitting && x.writPanel === null, 'the Kindled at the post', 50, 20);
expectMatch('held still, facing the post', h.pose, /^(sit|idle)\/0$/);
await page.screenshot({ path: join(OUT, '02a-sitting-at-the-post.png') });
console.log(`  02a-sitting-at-the-post.png (${h.pose})`);
const asleep = await untilTrue(sleeping, 'the sleep screen', 50, 50);
expectEq('the line', asleep.line, 'You lie down by the Writ. Its hum is the last thing you hear.');
expectEq('the holding gone', (await scenes()).includes('holding'), false);
await page.screenshot({ path: join(OUT, '02-sleep-screen.png') });
console.log('  02-sleep-screen.png');

// 3. The start screen after it: logged out on the server.
await waitScene('account');
expectEq('logged out', (await api('/api/me')).status, 401);
await shot('03-start-screen-logged-out');

// 4. Seven hours away at the trees, logged in again: the card.
console.log('the away card:');
cli('holding:away', '7');
const login = await api('/api/login', { username, password });
expectEq('logged in again', login.status, 200);
await land();
h = await until((x) => x.away !== null, 'the card');
let r = await api('/api/holding');
const card = r.body.away;
expectEq('the card on the wire', typeof card?.to, 'string');
expectMatch('the time away', h.away.lines[0], /^Away 7 hours\.$/);
// The Old field's 15 min trickle over 7 h (28 grains, ישן's bonus not yet due), the trees' basket, the skills line.
expectMatch('the field', h.away.lines[1], /^Field: \d+ pale grains, in the basket$/);
expectMatch('the trees', h.away.lines[2], /^Trees: \d+ twisted logs, in the basket$/);
expectMatch('the skills', h.away.lines[3], /^Woodcutting 1 → \d+$/);
expectEq('the Writ now', h.away.lines[4], 'Writ: about two days left');
expectEq('five lines', h.away.lines.length, 5);
expectEq('the title', h.away.title, 'While you were away');
expectEq('the hint', h.away.hint, 'Press anything to wake.');
expectEq('the field on the wire', card.made['plot-1']?.itemId, 'pale-grain');
expectEq('the Kindled stands still', h.prompt, false);
expectEq('the toasts wait', h.toasts.paused, true);
// Seven hours of 4 s cycles and 21 of the trees' trickle, plus the few seconds worked before the sleep.
const logsMade = card.made['twisted-trees'].quantity;
const least = (7 * 3600) / 4 + 21;
if (logsMade < least || logsMade > least + 30) throw new Error(`the card counts the trees: ${logsMade}, expected about ${least}`);
expectEq('the level on the wire', card.levels.woodcutting.from, 1);
console.log(`  ${h.away.lines.join(' | ')}`);
await shot('04-away-card');

// 5. Any key closes it: the row is gone on the server; the key did nothing else.
await page.keyboard.press('KeyW');
h = await until((x) => x.away === null, 'the card closed');
await untilTrue(async () => (await api('/api/holding')).body.away === null, 'the row gone');
expectEq('no panel opened', h.panel, null);
expectEq('still working', h.response.activity?.stationId, 'twisted-trees');
await shot('05-card-closed');

// 6. A level-up toast from working: Mining 2 after seven cycles at the outcrop.
console.log('the toasts:');
await useAt(outcropUse, 'the outcrop');
await until((x) => x.panel === 'stone-outcrop', "the outcrop's panel");
await clickButton('WORK HERE');
await until((x) => x.response?.activity?.stationId === 'stone-outcrop', 'working the outcrop');
await page.keyboard.press('Escape');
await until((x) => x.panel === null, 'the panel closed');
const t0 = Date.now();
await untilTrue(async () => (await api('/api/holding')).body.skills.mining.level >= 2, 'Mining 2 on the server', 120, 1000);
await refresh();
h = await until((x) => x.toasts.lines.includes('Mining 2.'), 'the level-up toast');
expectEq('its kind', h.toasts.kinds[h.toasts.lines.indexOf('Mining 2.')], 'skill-level');
console.log(`  "Mining 2." after ${Math.round((Date.now() - t0) / 1000)} s`);
await shot('06-level-up-toast', 100);
await untilTrue(async () => (await toasts()).lines.length === 0, 'the toast gone after its hold', 300, 100);

// 7. "Store: twisted logs full." under "Your Writ has about a day left.": two stacked, the newest at the bottom.
r = await api('/api/inventory');
cli('inv:grant', 'twisted-log', String(9999 - (r.body.store.find((e) => e.itemId === 'twisted-log')?.quantity ?? 0)));
await useAt(treeUse, 'the trees');
await until((x) => x.panel === 'twisted-trees', "the trees' panel");
cli('writ:set', '--charge-hours', '10');
await refresh();
await until((x) => x.toasts.lines.includes('Your Writ has about a day left.'), 'the Writ-low toast');
await clickButton('TAKE ALL');
h = await until((x) => x.toasts.lines.length === 2 && x.toasts.lines[1] === 'Store: twisted logs full.', 'the store-full toast under it');
expectEq('the two lines', h.toasts.lines.join('|'), 'Your Writ has about a day left.|Store: twisted logs full.');
expectEq('the kinds', h.toasts.kinds.join('|'), 'writ-low|store-full');
expectEq('the panel keeps no result line', h.result, '');
r = await api('/api/inventory');
expectEq('the store full', r.body.store.find((e) => e.itemId === 'twisted-log')?.quantity, 9999);
await shot('07-two-toasts-store-full', 100);
await page.keyboard.press('Escape');
await until((x) => x.panel === null, 'the panel closed');
await untilTrue(async () => (await toasts()).lines.length === 0, 'the toasts gone', 300, 100);

// 8. "Pack full." over the open inventory: the pack filled, a store cell clicked.
// The pack filled: the seeds already take a slot, so black stone fills the rest.
const slot = inventoryData.slotSize.material;
r = await api('/api/inventory');
const usedSlots = r.body.pack.reduce((n, e) => n + Math.ceil(e.quantity / slot), 0);
cli('inv:grant', 'black-stone', String(slot * (inventoryData.packSlots - usedSlots)), 'pack');
await page.keyboard.press('KeyI');
await waitScene('inventory');
await sleep(400);
const cell = await page.evaluate(() => window.__iot.game.scene.getScene('inventory').cellAt('store', 0));
const at = await toPage('inventory', cell.x + 12, cell.y + 12);
await page.mouse.click(at.x, at.y);
const packFull = await untilTrue(async () => {
  const t = await toasts();
  return t.lines.includes('Pack full.') ? t : null;
}, 'the Pack full. toast', 50, 100);
expectEq('its kind', packFull.kinds[0], 'pack-full');
expectEq('the inventory still open', (await scenes()).includes('inventory'), true);
await shot('08-pack-full-over-inventory', 100);
await page.keyboard.press('Escape');
await waitScene('holding');
await untilTrue(async () => (await toasts()).lines.length === 0, 'the toast gone', 300, 100);

// 9. "Your Writ has about a day left." on landing: 23 h of charge and a reload under 30 min, so no card shows and the
// toast tells the drain; a second reload doesn't toast it again (remembered per Kindled).
console.log('on landing:');
cli('writ:set', '--charge-hours', '23');
h = await land();
expectEq('no card under 30 min', h.away, null);
h = await until((x) => x.toasts.lines.includes('Your Writ has about a day left.'), 'the Writ-low toast on landing');
expectEq('the chip ember', h.writ.chip.ember, true);
await shot('09-writ-low-toast', 100);
await untilTrue(async () => (await toasts()).lines.length === 0, 'the toast gone', 300, 100);
await land();
await sleep(1500);
expectEq('told once per drain: not again after a reload', (await toasts()).lines.length, 0);

// 10. Dark 49 h and an hour away: the card's faded Writ line.
console.log('faded:');
cli('writ:set', '--dark-hours', '49');
cli('holding:away', '1');
await refresh();
h = await until((x) => x.away !== null, 'the card again');
expectEq('the time away', h.away.lines[0], 'Away 1 hour.');
expectEq('the faded Writ', h.away.lines.at(-1), 'Writ: dark for 2 tides and 1 hour; its outer line has faded.');
expectEq('no dark toast: the card told it', h.toasts.lines.length, 0);
r = await api('/api/holding');
expectEq('the Writ on the wire', r.body.writ.state, 'fading');
expectEq('the card on the wire', typeof r.body.away?.to, 'string');
await shot('10-away-card-faded-writ');
await page.keyboard.press('Space');
await until((x) => x.away === null, 'the card closed');
await untilTrue(async () => (await api('/api/holding')).body.away === null, 'the row gone');

await browser.close();
