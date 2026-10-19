#!/usr/bin/env node
/**
 * M2 Task 6 end to end (docs/screenshots/m2-6): build mode and upgrade
 * pieces. A new account and Kindled name the island, learn אדמה, name and sow
 * plot-1 (through the API, as Task 5's run showed them) and land by the
 * field. Its panel shows BUILD HERE; build mode opens with the side list
 * (the threshing floor locked, "Needs Writ line 2"); the clay channel picked
 * makes a ghost, green where it fits, red over the signpost, turned with R;
 * a click confirms and the building moment plays (slowed through the
 * tuning for the shot); the field's panel reads "Level 2" and "By itself:
 * 1 pale grain every 12 min". The seed jars without grain in the store
 * refuse with "Not enough in the store."; granted, they stand and the
 * header reads "Pieces 2/2". A standing piece is selected and moved, then
 * taken down ("+300 Twisted log" and "+150 Black stone" float over the signpost). `writ:set` fades the plot:
 * its pieces draw dim. Every state is checked through the API and the
 * scene's snapshot. Shots are whole-page screenshots at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-6.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-6'));
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

async function shot(name, settle = 300) {
  await sleep(settle);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

const holding = () => page.evaluate(() => window.__iot.holding());
const api = (route, body) =>
  page.evaluate(
    async ({ route, body }) => {
      const res = await fetch(
        route,
        body
          ? {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {},
      );
      return { status: res.status, body: await res.json() };
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
    ? {
        prompt: last.promptLabel,
        panel: last.panel,
        lines: last.panelLines,
        build: last.build,
        ghost: last.ghost,
        pieces: last.pieces,
        floats: last.floats,
        at: [last.state.x, last.state.y],
      }
    : null;
  throw new Error(`never: ${what} (${JSON.stringify(seen)})`);
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

/** A point of the world (world px) on the page, through the world camera. */
const worldToPage = (x, y) =>
  page.evaluate(
    ({ x, y }) => {
      const scene = window.__iot.holdingScene();
      const cam = scene.cameras.main;
      const canvas = window.__iot.game.canvas;
      const r = canvas.getBoundingClientRect();
      const css = r.width / canvas.width;
      return { x: r.left + (cam.x + (x - cam.scrollX) * cam.zoom) * css, y: r.top + (cam.y + (y - cam.scrollY) * cam.zoom) * css };
    },
    { x, y },
  );

/** The page point at the centre of a tile. */
const tileToPage = (col, row) => worldToPage((col + 0.5) * 32, (row + 0.5) * 32);

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

/** Click a line of text (a row of the side list) on the holding's UI camera. */
async function clickText(text) {
  const at = await page.evaluate((text) => {
    const scene = window.__iot.holdingScene();
    const objects = scene.children.list.flatMap((o) => (o.type === 'Layer' ? o.list : [o]));
    const t = objects.find((o) => o.type === 'BitmapText' && o.text === text && o.visible);
    return t ? { x: t.x + t.width / 2, y: t.y + 4 } : null;
  }, text);
  if (!at) throw new Error(`no text ${text}`);
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

const username = `build${Date.now() % 100000}`;
const cli = (script, ...args) => {
  const out = execFileSync(
    'pnpm',
    ['--silent', '--filter', '@iot/server', script, '--', username, ...args],
    { cwd: ROOT, encoding: 'utf8' },
  );
  console.log(`  ${out.trim()}`);
};
const expectEq = (what, got, want) => {
  if (got !== want)
    throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
const setTuning = (patch) =>
  page.evaluate((patch) => {
    const t = window.__iot.tuning.get();
    const next = { ...t };
    for (const [k, v] of Object.entries(patch)) next[k] = { ...t[k], ...v };
    window.__iot.tuning.set(next);
  }, patch);
const resetTuning = () =>
  page.evaluate(() => {
    window.__iot.tuning.reset();
  });
const refresh = () =>
  page.evaluate(() => {
    window.__iot.holdingScene().refresh();
  });

/** The layout's points (sim px), from the data. */
const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8'))
  .layouts[0];
const pieces = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/pieces.json'), 'utf8')).pieces;
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const plot = layout.plots[0];
const plotUse = centre(plot.station.interact);
const signpost = plot.station.rect;
console.log(`plot ${plot.id}: cols ${plot.rect.col}..${plot.rect.col + 5}, rows ${plot.rect.row}..${plot.rect.row + 5}; the signpost at (${signpost.col}, ${signpost.row})`);

/** Opens the panel at a plot by walking to its interact point and pressing Use. */
async function useAt(at, what) {
  await walkTo(at.x, at.y);
  await until((x) => x.promptLabel === 'USE', `the USE prompt at ${what}`);
  await page.keyboard.press('KeyE');
}

/** Moves the mouse over a tile (the ghost follows) and waits for the ghost to land there. */
async function hoverTile(col, row, what) {
  const p = await tileToPage(col, row);
  await page.mouse.move(p.x, p.y);
  await page.mouse.move(p.x + 1, p.y);
  return until((x) => x.pieces.ghost !== null, what, 50, 50);
}

await page.goto(BASE);
await waitScene('account');
const setup = await page.evaluate(async (username) => {
  const post = (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const reg = await post('/api/register', { username, password: 'correct horse battery' });
  const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
  const name = await post('/api/writ/name', { name: 'Black Rock' });
  const word = await post('/api/kesh/word', {});
  const plot = await post('/api/plots/name', { plotId: 'plot-1', ground: 'adamah', virtue: null });
  const seeds = await post('/api/kesh/seeds', {});
  const sown = await post('/api/plots/sow', { plotId: 'plot-1' });
  return [reg.status, k.status, name.status, word.status, plot.status, seeds.status, sown.status];
}, username);
if (setup.join() !== '201,201,200,200,200,200,200') throw new Error(`setup failed: ${setup.join()}`);
// The materials for the first piece: 1000 logs, 150 stone, no grain yet (the seed jars refuse later).
cli('inv:grant', 'twisted-log', '1000');
cli('inv:grant', 'black-stone', '150');
await page.reload();
await waitScene('start');
await page.keyboard.press('Enter');
await waitScene('holding');
let h = await until(
  (x) => x.response !== null && x.lettersLoaded && x.plots[0].drawn === 'named',
  'the holding answered with the sown field',
);
expectEq('level 1', h.response.plots[0].level, 1);
expectEq('no pieces', h.response.plots[0].pieces.length, 0);

// 1. BUILD HERE in the field's panel.
console.log('the panel:');
await useAt(plotUse, 'the field');
h = await until((x) => x.panel === plot.id, "the field's panel");
expectEq('the level', h.panelLines.level, 'Level 1');
expectEq('by hand', h.panelLines.rate, 'By hand: 1 pale grain every 20 s');
expectEq('by itself', h.panelLines.cycle, 'By itself: 1 pale grain every 15 min');
expectEq('the buttons', h.panelLines.buttons.join(), 'work,take,build,rename');
await shot('01-build-here');

// 2. Build mode: the side list, the threshing floor locked.
console.log('build mode:');
await clickButton('BUILD HERE');
h = await until((x) => x.build !== null, 'build mode open');
expectEq('the header', h.build.title, 'Field, level 1');
expectEq('the count', h.build.count, 'Pieces 0/2');
expectEq('the rows', h.build.rows.map((r) => r.name).join('|'), 'Clay channel|Seed jars|Threshing floor');
expectEq('the floor locked', h.build.rows[2].needs, 'Needs Writ line 2');
expectEq('the floor locked', h.build.rows[2].locked, true);
expectEq('the channel affordable', h.build.rows[0].materials.join('|'), 'Twisted log 1000/300|Black stone 150/150');
expectEq('the jars short of grain', h.build.rows[1].materials[1], 'Pale grain 0/40');
expectEq('the effect line', h.build.rows[0].effect, '+25% work speed');
expectEq('the ring on the ground', h.pieces.buildPlot, plot.id);
// The card as the hovered row's tooltip.
const rowAt = await page.evaluate((text) => {
  const scene = window.__iot.holdingScene();
  const objects = scene.children.list.flatMap((o) => (o.type === 'Layer' ? o.list : [o]));
  const t = objects.find((o) => o.type === 'BitmapText' && o.text === text && o.visible);
  return t ? { x: t.x + t.width / 2, y: t.y + 4 } : null;
}, 'Threshing floor');
const rp = await uiToPage(rowAt.x, rowAt.y);
await page.mouse.move(rp.x, rp.y);
h = await until((x) => x.build?.tip !== null, "the floor's card");
expectEq("LORE's card", h.build.tip, pieces.find((p) => p.id === 'threshing-floor').card);
await shot('02-build-mode-side-list');

// 3. A green ghost: the clay channel picked, over free ground west of the signpost.
console.log('the ghost:');
await clickText('Clay channel');
await until((x) => x.ghost?.pieceId === 'clay-channel', 'the ghost');
await hoverTile(plot.rect.col, plot.rect.row + 2, 'the ghost on the west column');
h = await until((x) => x.pieces.ghost?.fits === true, 'a green ghost');
expectEq('its footprint', `${h.pieces.ghost.cols}x${h.pieces.ghost.rows}`, '1x4');
await shot('03-green-ghost');

// 4. A red ghost over the signpost's tile.
await hoverTile(signpost.col, signpost.row, 'the ghost over the signpost');
await until((x) => x.pieces.ghost?.fits === false, 'a red ghost');
await shot('04-red-ghost-over-signpost');

// 5. Rotated with R: 4 × 1, along the plot's top row.
await page.keyboard.press('KeyR');
await until((x) => x.ghost?.rotation === 90, 'turned');
await hoverTile(plot.rect.col + 2, plot.rect.row, 'the turned ghost along the top row');
await until((x) => x.pieces.ghost?.fits === true && x.pieces.ghost.cols === 4, 'the turned ghost fitting');
await shot('05-rotated-ghost');
await page.keyboard.press('KeyR');
await page.keyboard.press('KeyR');
await page.keyboard.press('KeyR');
await until((x) => x.ghost?.rotation === 0, 'turned back');

// 6. Confirm: the building moment (slowed through the tuning), mid-rise.
console.log('building:');
await setTuning({ plots: { buildMs: 3000 } });
const ghostAt = await hoverTile(plot.rect.col, plot.rect.row + 1, 'the ghost on its place');
expectEq('green there', ghostAt.pieces.ghost.fits, true);
const place = await tileToPage(plot.rect.col, plot.rect.row + 2);
await page.mouse.click(place.x, place.y);
h = await until((x) => x.pieces.building === 'clay-channel', 'the building moment', 100, 30);
expectEq('the piece stands on the server', h.response.plots[0].pieces[0].pieceId, 'clay-channel');
expectEq('level 2', h.response.plots[0].level, 2);
expectEq('the ghost dropped', h.ghost, null);
await sleep(1500);
await page.screenshot({ path: join(OUT, '06-building-moment.png') });
console.log('  06-building-moment.png');
await resetTuning();
h = await until((x) => x.pieces.building === null, 'the piece standing');
expectEq('the header', h.build.title, 'Field, level 2');
expectEq('the count', h.build.count, 'Pieces 1/2');
expectEq('the row built', h.build.rows[0].built, true);
let r = await api('/api/inventory');
expectEq('the logs paid', r.body.store.find((e) => e.itemId === 'twisted-log')?.quantity, 700);
expectEq('the stone paid', r.body.store.find((e) => e.itemId === 'black-stone'), undefined);

// 7. The clay channel standing, "Level 2" and "By itself: 1 pale grain every 12 min".
console.log('the level:');
await page.keyboard.press('Escape');
await until((x) => x.build === null, 'build mode closed');
await useAt(plotUse, 'the field');
h = await until((x) => x.panel === plot.id && x.panelLines?.level === 'Level 2', 'the panel at level 2');
expectEq('by itself at 12 min', h.panelLines.cycle, 'By itself: 1 pale grain every 12 min');
expectEq('by hand unchanged', h.panelLines.rate, 'By hand: 1 pale grain every 20 s');
expectEq('the cycle on the wire', h.response.cycles[plot.id].cycleMs, 12 * 60_000);
expectEq('a pillar: the piece drawn', h.pieces.pieces[0].pieceId, 'clay-channel');
await shot('07-clay-channel-level-2');

// 8. "Not enough in the store.": the seed jars without grain.
console.log('insufficient:');
await clickButton('BUILD HERE');
await until((x) => x.build !== null, 'build mode again');
await clickText('Seed jars');
await until((x) => x.ghost?.pieceId === 'seed-jars', 'the jars ghost');
await hoverTile(plot.rect.col + 4, plot.rect.row + 5, 'the jars in the south-east corner');
await until((x) => x.pieces.ghost?.fits === true, 'a green ghost');
let at = await tileToPage(plot.rect.col + 4, plot.rect.row + 5);
await page.mouse.click(at.x, at.y);
h = await until((x) => x.build?.result === 'Not enough in the store.', 'the refusal line');
expectEq('still one piece', h.response.plots[0].pieces.length, 1);
await shot('08-not-enough-in-the-store', 100);

// 9. The grain granted: a second piece and "Pieces 2/2". The limit refusal can't be reached through the list in M2: the
// third field piece needs Writ line 2 (locked), and each kind stands once; the server's `limit` is covered by its tests.
console.log('the second piece:');
cli('inv:grant', 'pale-grain', '40');
await refresh();
await until((x) => x.build?.rows[1].materials[1] === 'Pale grain 40/40', 'the grain in the list');
await page.mouse.click(at.x, at.y);
h = await until((x) => x.build?.count === 'Pieces 2/2', 'two pieces', 100);
expectEq('level 3', h.response.plots[0].level, 3);
await until((x) => x.pieces.building === null, 'the jars standing');
await shot('09-two-pieces');

// 10. Moving a piece: the jars selected (a click on them), MOVE, the ghost placed elsewhere.
console.log('moving:');
await page.mouse.click(at.x, at.y);
await until((x) => x.build?.selected === 'seed-jars', 'the jars selected');
await clickButton('MOVE');
await until((x) => x.ghost?.moving === true, 'the moving ghost');
await hoverTile(plot.rect.col + 4, plot.rect.row + 1, 'the jars moved north-east');
await until((x) => x.pieces.ghost?.fits === true, 'a green ghost there');
await shot('10-moving-a-piece');
at = await tileToPage(plot.rect.col + 4, plot.rect.row + 1);
await page.mouse.click(at.x, at.y);
await until((x) => x.response?.plots[0].pieces.find((p) => p.pieceId === 'seed-jars')?.row === plot.rect.row + 1, 'moved on the server');
r = await api('/api/inventory');
expectEq('a move is free', r.body.store.find((e) => e.itemId === 'twisted-log')?.quantity, 500);

// 11. Taking the channel down: "+300 Twisted log" then "+150 Black stone" over the signpost, the materials back.
console.log('taking down:');
at = await tileToPage(plot.rect.col, plot.rect.row + 2);
await page.mouse.click(at.x, at.y);
await until((x) => x.build?.selected === 'clay-channel', 'the channel selected');
await clickButton('TAKE DOWN');
h = await until((x) => x.floats.includes("+300 Twisted log"), "the \"+300 Twisted log\"", 100, 30);
expectEq('one piece left', h.response.plots[0].pieces.map((p) => p.pieceId).join(), 'seed-jars');
expectEq('the count', h.build.count, 'Pieces 1/2');
await page.screenshot({ path: join(OUT, '11-take-down.png') });
console.log('  11-take-down.png');
r = await api('/api/inventory');
expectEq('the logs back', r.body.store.find((e) => e.itemId === 'twisted-log')?.quantity, 800);
expectEq('the stone back', r.body.store.find((e) => e.itemId === 'black-stone')?.quantity, 150);
await page.keyboard.press('Escape');
await until((x) => x.build === null, 'build mode closed');

// 12. A faded plot: its pieces dim.
console.log('faded:');
cli('writ:set', '--dark-hours', '49');
await refresh();
await until((x) => x.plots[0].drawn === 'faded' && x.pieces.pieces[0]?.dim === true, 'the plot faded, its piece dim');
const fadedRefusal = await api('/api/plots/build', { plotId: plot.id, pieceId: 'clay-channel', col: plot.rect.col, row: plot.rect.row, rotation: 0 });
expectEq('building refused while faded', fadedRefusal.body.error, 'faded');
await shot('12-faded-plot-dim-pieces');

await browser.close();
