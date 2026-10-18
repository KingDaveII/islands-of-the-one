#!/usr/bin/env node
/**
 * M2 Task 4a end to end (docs/screenshots/m2-4a): the Writ and the island's
 * Name. A new account and Kindled land on the holding; the Kindled walks to
 * the Writ post and uses it: the Name screen opens, a Name is typed and the
 * tablet is cut live as it is heard; confirming names the island (the server
 * hears the letters) and opens the Writ panel, freshly pressed (two days).
 * Then a sliver from the grant CLI is fed (humming and deep glass greyed),
 * `writ:set` makes the Writ flickering, dark and fading (the panel and the
 * HUD chip in each state, the chip's tooltip), a relight from dark plays, and
 * a full Writ refuses a sliver with "Full." (the panel's greyed line and the
 * API's refusal). Every state is checked through the API and the scene's
 * snapshot. Shots are whole-page screenshots at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-4a.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-4a'));
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
const api = (route, body) =>
  page.evaluate(
    async ({ route, body }) => {
      const res = await fetch(route, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
      return { status: res.status, body: await res.json() };
    },
    { route, body },
  );

/** Waits until the holding scene's snapshot satisfies `pred`. */
async function until(pred, what, tries = 100) {
  for (let i = 0; i < tries; i++) {
    const h = await holding();
    if (h && pred(h)) return h;
    await sleep(100);
  }
  const last = await holding();
  const seen = last ? { prompt: last.prompt, panel: last.panel, writPanel: last.writPanel?.state, nameScreen: last.nameScreen, at: [last.state.x, last.state.y] } : null;
  throw new Error(`never: ${what} (${JSON.stringify(seen)})`);
}

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

/** Click a button by its label on the holding's UI camera. */
async function clickButton(text) {
  const at = await page.evaluate((text) => {
    const scene = window.__iot.holdingScene();
    const objects = scene.children.list.flatMap((o) => (o.type === 'Layer' ? o.list : [o]));
    const found = objects
      .filter((o) => o.type === 'Container')
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

/** Click a line of text (a kind's row in the Writ panel) on the holding's UI camera. */
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

const username = `writ${Date.now() % 100000}`;
const cli = (script, ...args) => {
  const out = execFileSync('pnpm', ['--silent', '--filter', '@iot/server', script, '--', username, ...args], { cwd: ROOT, encoding: 'utf8' });
  console.log(`  ${out.trim()}`);
};
const expectEq = (what, got, want) => {
  if (got !== want) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};

/** The post's interact point (sim px), from the data. */
const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8')).layouts[0];
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const postUse = centre(layout.stations.find((s) => s.id === 'writ-post').parts[0].interact);

/** Open the Writ panel (or the Name screen) with Use at the post, fresh from the server. */
async function openPost(expectPanel = true) {
  const h = await holding();
  if (h.writPanel) {
    await page.keyboard.press('Escape');
    await until((x) => x.writPanel === null, 'the panel closed');
  }
  await walkTo(postUse.x, postUse.y);
  await until((x) => x.prompt, 'the USE prompt at the post');
  await page.keyboard.press('KeyE');
  if (expectPanel) return until((x) => x.writPanel !== null && x.writPanel.state !== '', 'the Writ panel');
  return until((x) => x.nameScreen !== null, 'the Name screen');
}

await page.goto(BASE);
await waitScene('account');
// 1. The account and Kindled through the API (M2 Task 1 covers their screens), then the holding.
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
await page.keyboard.press('Enter');
await waitScene('holding');
let h = await until((x) => x.response !== null && x.lettersLoaded, 'the holding answered and the letter sheet loaded');
expectEq('pressed: unnamed', h.response.writ.name, null);
expectEq('pressed: lit', h.response.writ.state, 'lit');
expectEq('pressed: two days', h.response.writ.words, 'about two days');
expectEq('the HUD shows the chip alone', h.writ.name, null);
await shot('01-holding-unnamed');

// 2. The Name screen, the tablet cut live as the Name is typed.
console.log('the Name screen:');
await openPost(false);
await shot('02-name-screen');
await page.keyboard.type('Black Rock', { delay: 60 });
h = await until((x) => x.nameScreen?.letters === 'בלק רוק', 'the tablet heard the Name');
console.log(`  typed "${h.nameScreen.typed}" → ${h.nameScreen.letters}`);
await shot('03-name-typed');
// A refused Name shows its line (the typed rules: one letter).
await page.keyboard.press('Control+A');
await page.keyboard.type('A');
await page.keyboard.press('Enter');
h = await until((x) => x.nameScreen?.error !== '', 'the refusal line');
console.log(`  refused: "${h.nameScreen.error}"`);
await shot('04-name-refused');
await page.keyboard.press('Control+A');
await page.keyboard.type('Black Rock', { delay: 40 });
await until((x) => x.nameScreen?.letters === 'בלק רוק', 'the tablet again');
await page.keyboard.press('Enter');
await until((x) => x.nameScreen?.accepted !== null && x.nameScreen?.accepted !== undefined, 'the Name accepted (the flare)', 50);
await page.screenshot({ path: join(OUT, '05-name-accepted-flare.png') });
console.log('  05-name-accepted-flare.png');
h = await until((x) => x.writPanel !== null, 'the Writ panel after the flare');
let r = await api('/api/holding');
expectEq('named', r.body.writ.name, 'Black Rock');
expectEq('letters heard on the server', r.body.writ.letters, 'בלק רוק');
expectEq('a second naming is refused', (await api('/api/writ/name', { name: 'Ash' })).body.error, 'already-named');
console.log(`  named "${r.body.writ.name}" → ${r.body.writ.letters}; the HUD: ${JSON.stringify(h.writ)}`);

// 3. The Writ panel, freshly pressed: two days.
console.log('the Writ panel:');
expectEq('panel state', h.writPanel.state, 'lit');
expectEq('panel charge', h.writPanel.charge, 'Charge: about two days');
expectEq('panel state line', h.writPanel.stateLine, 'Lit');
expectEq('panel line 1', h.writPanel.line1, 'Line 1: tethers 4 plots · lit');
expectEq('nothing to feed yet', h.writPanel.feedOn, false);
console.log(`  ${JSON.stringify(h.writPanel.kinds)}`);
await shot('06-panel-pressed');

// 4. One sliver from the grant CLI, fed: four days; humming and deep glass greyed.
cli('inv:grant', 'wild-sliver', '1');
cli('inv:grant', 'glass-chip', '1');
cli('inv:grant', 'deep-glass', '1');
await openPost();
h = await until((x) => x.writPanel?.feedOn === true, 'the sliver in the panel');
expectEq('the preview', h.writPanel.preview, '+1/3 charge, about four days');
const greyed = Object.fromEntries(h.writPanel.kinds.map((k) => [k.itemId, k.refusal]));
expectEq('humming glass greyed', greyed['glass-chip'], 'Too much for your Writ now');
expectEq('deep glass greyed', greyed['deep-glass'], 'Too much for one Writ');
await shot('07-panel-sliver-preview');
await clickButton('FEED ONE');
h = await until((x) => x.response?.writ.words === 'about four days', 'the feed landed');
r = await api('/api/inventory');
expectEq('the sliver burned', r.body.store.find((e) => e.itemId === 'wild-sliver'), undefined);
console.log(`  fed one sliver: ${h.response.writ.words}, ${h.response.writ.state}`);
await shot('08-panel-fed');

// 5. Flickering, dark and fading through writ:set: the panel and the HUD chip in each state.
console.log('the states:');
cli('writ:set', '--charge-hours', '10');
await openPost();
h = await until((x) => x.writPanel?.state === 'flickering', 'flickering');
expectEq('flickering line', h.writPanel.stateLine, 'Flickering');
expectEq('the chip ember', h.writ.chip.ember, true);
expectEq('the chip words', h.writ.chip.text, 'less than a day');
await shot('09-panel-flickering');
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');
await shot('10-chip-flickering');

cli('writ:set', '--dark-hours', '5');
await openPost();
h = await until((x) => x.writPanel?.state === 'dark', 'dark');
if (!/^Dark since (4 h 59|5 h 0) min, grace ends in 4[23] h \d+ min$/.test(h.writPanel.stateLine)) throw new Error(`dark line: ${h.writPanel.stateLine}`);
console.log(`  ${h.writPanel.stateLine}`);
expectEq('the chip reads met', h.writ.chip.letters, 'מת');
expectEq('a humming glass fits a dark Writ', h.writPanel.kinds.find((k) => k.itemId === 'glass-chip').enabled, true);
await shot('11-panel-dark');
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');
await shot('12-chip-dark');

cli('writ:set', '--dark-hours', '60');
await openPost();
h = await until((x) => x.writPanel?.state === 'fading', 'fading');
expectEq('fading line', h.writPanel.stateLine, 'Line 1 fading');
expectEq('line 1 faded', h.writPanel.line1, 'Line 1: tethers 4 plots · faded');
await shot('13-panel-fading');

// 6. A relight from dark: the aleph first, then the line, over a few seconds.
cli('inv:grant', 'wild-sliver', '2', 'pack');
await openPost();
await until((x) => x.writPanel?.kinds.find((k) => k.itemId === 'wild-sliver')?.enabled === true, 'slivers in the pack');
await clickText('Wild slivers');
h = await until((x) => x.writPanel?.selected === 'wild-sliver' && x.writPanel.feedOn, 'the slivers row chosen');
expectEq('the relight preview', h.writPanel.preview, '+1/3 charge, about two days');
await clickButton('FEED ONE');
await until((x) => x.writPanel?.relighting === true, 'the relight');
await page.screenshot({ path: join(OUT, '14-relight.png') });
console.log('  14-relight.png');
h = await until((x) => x.writPanel?.relighting === false && x.response?.writ.state === 'lit', 'relit');
expectEq('relit from now', h.response.writ.words, 'about two days');
await shot('15-panel-relit');

// 7. Lit: the chip with its tooltip (the exact time) on hover.
cli('writ:set', '--charge-hours', '100');
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');
await openPost();
await until((x) => x.writPanel?.state === 'lit' && x.writ.chip.text === 'about four days', 'lit again');
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');
h = await holding();
const rect = h.writRect;
const over = await uiToPage(rect.x + rect.w / 2, rect.y + rect.h / 2);
await page.mouse.move(over.x, over.y);
h = await until((x) => x.writTip, 'the chip tooltip');
console.log(`  chip: ${h.writ.chip.text}, tooltip ${h.writ.chip.tooltip}`);
await shot('16-chip-lit-tooltip');
await page.mouse.move(10, 10);

// 8. Full: 100 h of charge, a sliver doesn't fit: "Full." in the panel (the buttons disabled) and from the API.
console.log('full:');
await openPost();
await until((x) => x.writPanel?.state === 'lit', 'the panel lit');
await clickText('Wild slivers');
h = await until((x) => x.writPanel?.selected === 'wild-sliver', 'the slivers row chosen');
expectEq('the preview says Full.', h.writPanel.preview, 'Full.');
expectEq('feed disabled', h.writPanel.feedOn, false);
expectEq('fill disabled', h.writPanel.fillOn, false);
const refused = await api('/api/writ/feed', { itemId: 'wild-sliver', count: 1 });
expectEq('the API refuses', refused.status, 409);
if (refused.body.error !== 'full' || refused.body.message !== 'Full.') throw new Error(`refusal: ${JSON.stringify(refused.body)}`);
const fill = await api('/api/writ/feed', { fill: true });
if (fill.body.error !== 'full') throw new Error(`fill refusal: ${JSON.stringify(fill.body)}`);
console.log(`  ${JSON.stringify(refused.body)}`);
await shot('17-panel-full');

await browser.close();
