#!/usr/bin/env node
/**
 * M2 Task 10 end to end (docs/screenshots/m2-10): touch controls, on an
 * emulated phone (Playwright `hasTouch`, 844 × 390 CSS at 3, multi-touch
 * through CDP `Input.dispatchTouchEvent`). The portrait line; the login form
 * and the island's Name typed on the phone; the holding with the left stick
 * held (the Kindled walking, then running); a tap on a far station walking
 * the Kindled there along a path and opening its panel, a tap outside closing
 * it, a tap on a station in reach opening it at once, a tap on the ground
 * walking there; the inventory by the pack button; the gear back to the
 * start screen; a run with the left stick held while LIGHT is tapped (the
 * soft lock) and dragged (the aim line, fired on release), HEAVY pressed,
 * dragged and released, DODGE and the Haul. Every state is checked through
 * the scenes' snapshots and the sim's state; nothing under packages/sim is
 * touched (the replay of the run's record gives its hash).
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-10.mjs [outDir] [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-10'));
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
const expectEq = (what, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
const expect = (what, ok, detail = '') => {
  if (!ok) throw new Error(`${what}${detail ? `: ${detail}` : ''}`);
};

const PHONE = { width: 844, height: 390 };
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromiumPath() });
const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
const cdp = await context.newCDPSession(page);

const scenes = () => page.evaluate(() => window.__iot?.game.scene.getScenes(true).map((s) => s.scene.key) ?? []);
async function waitScene(key, tries = 150) {
  for (let i = 0; i < tries; i++) {
    if ((await scenes()).includes(key)) return;
    await sleep(100);
  }
  throw new Error(`scene ${key} never started (active: ${(await scenes()).join(', ')})`);
}

async function shot(name, settle = 250) {
  await sleep(settle);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

// --- Fingers ------------------------------------------------------------------

/**
 * The fingers on the glass (CSS px), by id. Several fingers at once are
 * TouchEvents built in the page on the canvas (changedTouches, touches), so
 * one can lift while the others stay down: CDP's `Input.dispatchTouchEvent`
 * can only end every touch at once. A single tap goes through CDP, so the
 * browser makes its pointer events (the active device switches to touch).
 */
const fingers = new Map();
const fire = (type, changed) =>
  page.evaluate(
    ({ type, changed, all }) => {
      const canvas = document.querySelector('#game canvas');
      const touch = (f) => new Touch({ identifier: f.id, target: canvas, clientX: f.x, clientY: f.y, pageX: f.x + window.scrollX, pageY: f.y + window.scrollY, screenX: f.x, screenY: f.y, radiusX: 4, radiusY: 4, force: 1 });
      const touches = all.map(touch);
      canvas.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, changedTouches: changed.map(touch), touches, targetTouches: touches }));
    },
    { type, changed, all: [...fingers.values()] },
  );
async function down(id, at) {
  const f = { id, x: at.x, y: at.y };
  fingers.set(id, f);
  await fire('touchstart', [f]);
}
async function move(id, at, steps = 6) {
  const f = fingers.get(id);
  for (let i = 1; i <= steps; i++) {
    const g = { id, x: f.x + ((at.x - f.x) * i) / steps, y: f.y + ((at.y - f.y) * i) / steps };
    fingers.set(id, g);
    await fire('touchmove', [g]);
    await sleep(16);
  }
}
async function up(id) {
  const f = fingers.get(id);
  fingers.delete(id);
  await fire('touchend', [f]);
}
/** A tap: with no other finger down, through CDP (its start and end sent together: CDP waits a frame before it answers, so a start awaited first lands as a long press); with fingers down, in the page. */
async function tap(at) {
  if (fingers.size > 0) {
    const f = { id: 9, x: at.x, y: at.y };
    fingers.set(9, f);
    await fire('touchstart', [f]);
    fingers.delete(9);
    await fire('touchend', [f]);
    await sleep(150);
    return;
  }
  const point = { id: 9, x: at.x, y: at.y, radiusX: 4, radiusY: 4, force: 1 };
  await Promise.all([
    cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] }),
    cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
  ]);
  await sleep(150);
}

// --- Reading the game --------------------------------------------------------

const api = (route, body) =>
  page.evaluate(
    async ({ route, body }) => {
      const res = await fetch(route, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
      const text = await res.text();
      return { status: res.status, body: text === '' ? null : JSON.parse(text) };
    },
    { route, body },
  );

const holding = () => page.evaluate(() => window.__iot.holding());

async function until(read, pred, what, tries = 150, every = 50) {
  let s;
  for (let i = 0; i < tries; i++) {
    s = await read();
    if (s !== undefined && s !== null && pred(s)) return s;
    await sleep(every);
  }
  throw new Error(`never: ${what} (${JSON.stringify(s)?.slice(0, 600)})`);
}

/** A UI point (UI px) of a scene on the page (CSS px): the UI camera sits at zU over the whole canvas. */
const uiToPage = (key, ui) =>
  page.evaluate(
    ({ key, ui }) => {
      const s = window.__iot.game.scene.getScene(key);
      const c = s.game.canvas;
      const r = c.getBoundingClientRect();
      const z = s.fits ? s.fits().ui.zU : s.uiZoom();
      return { x: r.left + (ui.x * z * r.width) / c.width, y: r.top + (ui.y * z * r.height) / c.height };
    },
    { key, ui },
  );
/** A point of the world (sim px) on the page, through the holding's projection. */
const simToPage = (sim) =>
  page.evaluate((sim) => {
    const s = window.__iot.holdingScene();
    const ui = s.toUi(sim.x, sim.y);
    const z = s.uiZoom();
    const c = s.game.canvas;
    const r = c.getBoundingClientRect();
    return { x: r.left + (ui.x * z * r.width) / c.width, y: r.top + (ui.y * z * r.height) / c.height };
  }, sim);
/** The centre on the page (CSS px) of a scene's text reading `text` (a button's label), through the camera that draws it. */
const labelAt = (key, text) =>
  page.evaluate(
    ({ key, text }) => {
      const s = window.__iot.game.scene.getScene(key);
      const find = (list) => {
        for (const o of list) {
          if (o.visible === false) continue;
          if (o.text === text) return o;
          const inner = o.list ? find(o.list) : null;
          if (inner) return inner;
        }
        return null;
      };
      const t = find(s.children.list);
      if (!t) return null;
      const b = t.getBounds();
      const cams = s.cameras.cameras;
      // A menu has one camera; a scene with a world camera draws its UI on the last one.
      const cam = cams[cams.length - 1];
      const c = s.game.canvas;
      const r = c.getBoundingClientRect();
      const sx = (b.centerX - cam.scrollX) * cam.zoom + cam.x;
      const sy = (b.centerY - cam.scrollY) * cam.zoom + cam.y;
      return { x: r.left + (sx * r.width) / c.width, y: r.top + (sy * r.height) / c.height };
    },
    { key, text },
  );
async function tapLabel(key, text) {
  const at = await labelAt(key, text);
  if (!at) throw new Error(`no "${text}" on ${key}`);
  await tap(at);
}

/** A touch control's centre on the page, from the layer's layout in a scene. */
async function controlAt(key, id) {
  const c = await page.evaluate(
    ({ key, id }) => {
      const s = window.__iot.game.scene.getScene(key);
      const k = s.touch.layout.controls.find((x) => x.id === id);
      return k ? { x: k.cx, y: k.cy } : null;
    },
    { key, id },
  );
  if (!c) throw new Error(`no ${id} in ${key}`);
  return uiToPage(key, c);
}

const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8')).layouts[0];
const TILE = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/rooms.json'), 'utf8')).tileSize;
const centre = (t) => ({ x: (t.col + 0.5) * TILE, y: (t.row + 0.5) * TILE });
const rectCentre = (r) => ({ x: (r.col + r.cols / 2) * TILE, y: (r.row + r.rows / 2) * TILE });
const station = (id) => layout.stations.find((s) => s.id === id);

const username = `touch${Date.now() % 100000}`;
const password = 'correct horse battery';

// --- 1. The portrait line -----------------------------------------------------
console.log('the portrait line:');
await page.setViewportSize({ width: PHONE.height, height: PHONE.width });
await page.goto(BASE);
// A phone held upright: the line covers the game from the first frame, every scene paused under it.
await until(() => page.evaluate(() => window.__iot?.game.scene.getScene('portrait')?.blocked ?? false), (b) => b === true, 'the portrait line');
await until(() => page.evaluate(() => window.__iot.game.scene.isPaused('account')), (b) => b === true, 'the account screen paused under it');
expectEq('its form hidden', await page.evaluate(() => document.body.classList.contains('turn-sideways')), true);
await shot('01-portrait');
await page.setViewportSize(PHONE);
await until(() => page.evaluate(() => window.__iot.game.scene.getScene('portrait').blocked), (b) => b === false, 'back to landscape');
await waitScene('account');
await tap({ x: 20, y: 20 });
expectEq('the device is touch', await page.evaluate(() => window.__iot.device()), 'touch');

// --- 2. The login form on the phone -------------------------------------------
console.log('the login form:');
const inputs = await page.$$('.game-input');
expect('the account form has its inputs', inputs.length >= 2, String(inputs.length));
const reg = await api('/api/register', { username, password });
expectEq('registered', reg.status, 201);
await api('/api/logout', {});
await page.reload();
await waitScene('account');
const userBox = await page.$('.game-input[autocomplete="username"]');
const passBox = await page.$('.game-input[type="password"]');
expect('username and password inputs', userBox && passBox);
await userBox.tap();
await page.keyboard.type(username);
await passBox.tap();
await page.keyboard.type(password);
await shot('02-login-form');
await page.keyboard.press('Enter');
await waitScene('creation');
const k = await api('/api/kindled', { name: 'Iltani', remembrance: 'ash' });
expectEq('a Kindled', k.status, 201);
await page.reload();
await waitScene('start');

// --- 3. The holding: the left stick --------------------------------------------
console.log('the holding, the stick:');
await tap({ x: 20, y: 20 });
await tapLabel('start', 'HOLDING');
await waitScene('holding');
let h = await until(holding, (x) => x.response !== null && x.touch.shown, 'the holding answered, the touch layer up');
const start = h.state;
// The stick: a thumb on the left half, pushed right past the travel.
const thumb = { x: 160, y: 270 };
await down(1, thumb);
await move(1, { x: thumb.x + 120, y: thumb.y });
await sleep(400);
h = await holding();
expectEq('walking', h.state.gait, 'walk');
expect('moved right', h.state.x > start.x + 4, `${start.x} → ${h.state.x}`);
await shot('03-holding-stick-walk', 0);
await until(holding, (x) => x.state.gait === 'run', 'breaks into a run', 80, 50);
await shot('04-holding-stick-run', 100);
await up(1);
await until(holding, (x) => x.state.gait !== 'run', 'stops');

// --- 4. Tap to walk and use -----------------------------------------------------
console.log('tap to walk and use:');
const tree = station('twisted-trees').parts[2];
const treeAt = rectCentre(tree.rect);
await tap(await simToPage({ x: treeAt.x, y: treeAt.y - 4 }));
await until(holding, (x) => x.walking, 'a walk to the tree');
await sleep(500);
h = await holding();
expect('walking toward the tree', h.walking && h.panel === null);
await shot('05-tap-far-walking', 0);
h = await until(holding, (x) => x.panel === 'twisted-trees', "the tree's panel on arrival", 200, 50);
const use = centre(tree.interact);
expect('arrived at its interact point', Math.hypot(h.state.x - use.x, h.state.y - use.y) <= 40, JSON.stringify(h.state));
await shot('06-tap-far-arrived-panel');
// A tap outside the panel closes it (Circle's meaning).
await tap({ x: 700, y: 120 });
h = await until(holding, (x) => x.panel === null, 'the panel closed by a tap outside');
expect('and nothing walks', !h.walking);
await shot('07-tap-outside-closed');
// The tree again, now in reach: its panel at once, no walk.
await tap(await simToPage({ x: treeAt.x, y: treeAt.y - 4 }));
await until(holding, (x) => x.panel === 'twisted-trees', 'the panel at once');
await shot('08-tap-near-panel');
// WORK HERE by tap; the chip shows the action; a tap on the chip stops it.
await tapLabel('holding', 'WORK HERE');
await until(holding, (x) => x.chip !== null, 'working: the chip');
await tap({ x: 700, y: 120 });
await until(holding, (x) => x.panel === null, 'closed again');
await shot('09-working-chip');
const chipRect = await page.evaluate(() => window.__iot.holdingScene().hud.chipRect);
await tap(await uiToPage('holding', { x: chipRect.x + chipRect.w / 2, y: chipRect.y + chipRect.h / 2 }));
await until(holding, (x) => x.chip === null, 'the chip tapped: stopped');
// Plain ground: walk there.
const ground = { col: 20, row: 5 };
await tap(await simToPage(centre(ground)));
await until(holding, (x) => x.walking, 'a walk to the ground');
await sleep(700);
await shot('10-tap-ground-walking', 0);
h = await until(holding, (x) => !x.walking, 'arrived', 200, 50);
expect('on the tapped tile', Math.floor(h.state.x / TILE) === ground.col && Math.floor(h.state.y / TILE) === ground.row, JSON.stringify(h.state));
await shot('11-tap-ground-arrived');

// --- 5. The island's Name on the phone ---------------------------------------
console.log("the island's Name:");
const post = station('writ-post').parts[0];
await tap(await simToPage({ x: rectCentre(post.rect).x, y: rectCentre(post.rect).y - 6 }));
await until(holding, (x) => x.nameScreen !== null, 'the Name screen at the post', 300, 50);
const nameBox = await page.$('.game-input');
expect('the Name input', nameBox);
await nameBox.tap();
await page.keyboard.type('Shoreward');
expectEq("typing in the field (the phone's keyboard) keeps touch the device", await page.evaluate(() => window.__iot.device()), 'touch');
await shot('12-name-screen-typed');
await tapLabel('holding', 'CONFIRM');
await until(holding, (x) => x.response?.writ.name === 'Shoreward', 'the island named', 200, 50);
// Kesh's lines: each tap advances them; then the Writ panel, closed by the gear.
await until(holding, (x) => x.nameScreen === null, 'the Name screen closed', 200, 50);
let talked = false;
for (let i = 0; i < 40; i++) {
  h = await holding();
  if (h.talk) {
    if (!talked) await shot('13-talk-by-tap', 300);
    talked = true;
    await tap({ x: 420, y: 150 });
    await sleep(250);
    continue;
  }
  if (h.writPanel) {
    await tap(await controlAt('holding', 'gear'));
    await sleep(250);
    continue;
  }
  if (talked && !h.sealing && !h.talk && !h.writPanel) break;
  await sleep(200);
}
expect("Kesh's lines played and closed by taps", talked && !(await holding()).talk);

// --- 6. The pack button, the gear -----------------------------------------------
console.log('the pack button and the gear:');
await tapLabel('holding', 'PACK 0/20');
await waitScene('inventory');
await shot('14-inventory-by-pack', 500);
await tapLabel('inventory', 'BACK');
await until(holding, (x) => x !== null && !x.walking, 'back on the holding');
await sleep(300);
await tap(await controlAt('holding', 'gear'));
await waitScene('start');
await shot('15-gear-start', 400);

// --- 7. A run -------------------------------------------------------------------
console.log('a run:');
await tapLabel('start', 'START RUN');
await waitScene('game');
const run = () =>
  page.evaluate(() => {
    const s = window.__iot.scene();
    if (!s) return null;
    const st = s.session.state;
    return {
      context: st.context,
      player: { x: st.player.x, y: st.player.y, action: st.player.action, hp: st.player.hp, aim: st.player.aim },
      husks: st.husks.filter((h) => h.core > 0 && h.action !== 'spawn').map((h) => ({ id: h.id, x: h.x, y: h.y })),
      reticle: s.controls.reticle(),
      input: s.controls.lastInput,
      touch: s.touch.shown,
      stick: s.touch.input.stick(),
      pointers: s.input.manager.pointers.map((p) => `${p.id}:${p.isDown}:${p.wasTouch}`),
    };
  });
let g = await until(run, (x) => x.touch && x.context === 'combat' && x.husks.length > 0, 'a hostile awake', 300, 50);
await page.evaluate(() => window.__iot.setSpeed(0.35));
// Every tick's player action, as the sampler sees it (a thrust lasts a few ticks: a frame's poll can miss it).
await page.evaluate(() => {
  const s = window.__iot.scene();
  const sample = s.controls.sample.bind(s.controls);
  window.__actions = [];
  s.controls.sample = (...args) => {
    window.__actions.push(s.session.state.player.action);
    return sample(...args);
  };
});
const actionsSince = (n) => page.evaluate((n) => window.__actions.slice(n), n);
const actionCount = () => page.evaluate(() => window.__actions.length);
// The stick toward the nearest Husk, 10° off it: the soft lock (20° on touch) snaps the aim onto it.
const nearest = g.husks.map((h) => ({ ...h, d: Math.hypot(h.x - g.player.x, h.y - g.player.y) })).sort((a, b) => a.d - b.d)[0];
const toHusk = Math.atan2(nearest.y - g.player.y, nearest.x - g.player.x);
const off = toHusk + (10 * Math.PI) / 180;
const runThumb = { x: 130, y: 260 };
await down(1, runThumb);
await move(1, { x: runThumb.x + Math.cos(off) * 40, y: runThumb.y + Math.sin(off) * 40 });
await sleep(200);
await tap(await controlAt('game', 'light'));
g = await until(run, (x) => x.player.action === 'light', 'LIGHT fires on the tap', 100, 30);
expect('soft-locked onto the Husk', g.reticle.kind === 'pad' && g.reticle.targetId === nearest.id, JSON.stringify(g.reticle));
await shot('16-run-light-tap-soft-lock', 0);
// LIGHT dragged off its button: the aim line, the aim the drag's; fired on release.
await until(run, (x) => x.player.action !== 'light', 'the swing over', 200, 30);
const light = await controlAt('game', 'light');
await down(2, light);
await move(2, { x: light.x - 60, y: light.y - 60 });
await sleep(200);
g = await run();
expect('the aim line while dragged', g.reticle.line > 0, JSON.stringify(g.reticle));
expect('not fired yet', g.player.action !== 'light');
const want = Math.round((((-3 * Math.PI) / 4 / (2 * Math.PI)) * 4096)) & 4095;
expectEq('aimed by the drag', g.input.aim, want);
await shot('17-run-light-drag-aim-line', 0);
await up(2);
g = await until(run, (x) => x.player.action === 'light', 'LIGHT fires on release', 100, 30);
await until(run, (x) => x.player.action !== 'light', 'the swing over', 200, 30);
// HEAVY: pressed (the charge), dragged (aimed), released (the thrust).
const heavy = await controlAt('game', 'heavy');
// A press while the Kindled is hurt starts nothing, and a hit while charging cancels the charge (the sim's rules, as
// with R2): the fight goes on round the shots, so try again until a charge is pressed, dragged and released whole.
for (let attempt = 0; ; attempt++) {
  if (attempt > 5) throw new Error('HEAVY never charged and fired without a hit in between');
  await until(run, (x) => x.player.action === 'idle', 'free to act', 300, 30);
  await down(3, heavy);
  try {
    await until(run, (x) => x.player.action === 'charge', 'HEAVY charges on press', 30, 30);
  } catch {
    await up(3);
    continue;
  }
  await move(3, { x: heavy.x + 70, y: heavy.y - 30 });
  await sleep(300);
  g = await run();
  if (g.player.action !== 'charge') {
    await up(3);
    continue;
  }
  await shot('18-run-heavy-charge-drag', 0);
  // Slower for the thrust's few frames, so the shot catches it.
  await page.evaluate(() => window.__iot.setSpeed(0.1));
  const released = await actionCount();
  await up(3);
  const fired = await until(() => actionsSince(released), (x) => x.includes('heavy') || x.includes('hurt'), 'the release', 100, 20);
  const thrust = fired.indexOf('heavy');
  const hit = fired.indexOf('hurt');
  if (thrust >= 0 && (hit < 0 || thrust < hit)) break;
  await page.evaluate(() => window.__iot.setSpeed(0.35));
}
await shot('19-run-heavy-release', 0);
await page.evaluate(() => window.__iot.setSpeed(0.35));
await until(run, (x) => x.player.action === 'idle', 'the thrust over', 300, 30);
// DODGE on press, the Haul on release.
await tap(await controlAt('game', 'dodge'));
g = await until(run, (x) => x.player.action === 'dodge', 'DODGE on the press', 100, 20);
await shot('20-run-dodge', 0);
await until(run, (x) => x.player.action !== 'dodge', 'the roll over', 300, 30);
await sleep(300);
await tap(await controlAt('game', 'ability1'));
g = await until(run, (x) => x.player.action === 'ability', 'the Haul on the tap', 100, 20);
await shot('21-run-haul', 0);
await up(1);
// The input log holds the resolved actions: the record replays to the same hash.
const same = await page.evaluate(() => {
  const r = window.__iot.record();
  window.__iot.setSpeed(0);
  return window.__iot.replayHash(r) === window.__iot.hash();
});
expect('the run replays to the same hash', same);

// The arc shows the unlocked abilities only (the Haul alone in M2), and the gear leaves the run on a second tap within
// 2 s (GAME DESIGN, 2026-10-21).
console.log('the gear in a run:');
const abilityIds = await page.evaluate(() =>
  window.__iot.game.scene.getScene('game').touch.layout.controls.map((c) => c.id).filter((id) => id.startsWith('ability')),
);
expectEq('the Haul alone in the arc', abilityIds, ['ability1']);
await page.evaluate(() => window.__iot.setSpeed(1));
const gear = await controlAt('game', 'gear');
// The shot: a slow headless frame can outlast the 2 s window, so the line is held longer for the picture only.
await page.evaluate(() => {
  window.__iot.game.scene.getScene('game').leaveRun.windowMs = 20000;
});
await tap(gear);
await sleep(200);
expect('one tap keeps the run', (await scenes()).includes('game'));
expectEq(
  'the line beside the gear',
  await page.evaluate(() => window.__iot.game.scene.getScene('game').touch.note?.text ?? null),
  'Tap again to leave the run.',
);
await shot('22-run-gear-tap-again', 600);
// Then the real window: a second tap after 2 s only arms it again; two taps within it leave.
await page.evaluate(() => {
  const g = window.__iot.game.scene.getScene('game').leaveRun;
  g.windowMs = 2000;
  g.reset();
});
await tap(gear);
await sleep(2300);
await tap(gear);
await sleep(200);
expect('a second tap after 2 s only arms it again', (await scenes()).includes('game'));
await tap(gear);
await waitScene('start');
console.log('  two taps left the run');

console.log('done');
await browser.close();
