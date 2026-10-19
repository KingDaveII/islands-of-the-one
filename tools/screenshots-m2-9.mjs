#!/usr/bin/env node
/**
 * M2 Task 9 end to end (docs/screenshots/m2-9): the creation update. A new
 * account goes through creation: the opening line on black; Remembrance
 * (Tide chosen with a click, the focus moved on to NEXT, the card still
 * hovered: the Narrator's hover line); Appearance (the red tone, the figure
 * mid-turn, the tones' Narrator line), then the figure turned by hand (a
 * drag, then Left/Right) to face west, the turning paused; Name (the
 * empty-field line); a name the safe-letters filter refuses, with LORE's
 * refusal line (the field cleared again before the shot, so the refused
 * name is not in the picture; the server refuses it with the same line);
 * the closing line on black; the start screen with the Kindled made, its
 * Remembrance and tone read back from GET /api/me. Every state is checked
 * through the scene's snapshot (`snapshot()` on the creation scene) and the
 * lines against creation.json. Shots are whole-page screenshots at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-9.mjs [outDir] [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-9'));
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

const snap = () => page.evaluate(() => window.__iot.game.scene.getScene('creation').snapshot());

/** Waits until the creation scene's snapshot satisfies `pred`. */
async function until(pred, what, tries = 100, every = 50) {
  for (let i = 0; i < tries; i++) {
    const s = await snap();
    if (pred(s)) return s;
    await sleep(every);
  }
  throw new Error(`never: ${what} (${JSON.stringify(await snap())})`);
}

const api = (route, body) =>
  page.evaluate(
    async ({ route, body }) => {
      const res = await fetch(route, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
      const text = await res.text();
      return { status: res.status, body: text === '' ? null : JSON.parse(text) };
    },
    { route, body },
  );

/** A point of the 480 × 270 layout (UI px) on the page (CSS px), through the creation scene's camera. */
const toPage = (x, y) =>
  page.evaluate(
    ({ x, y }) => {
      const s = window.__iot.game.scene.getScene('creation');
      const cam = s.cameras.main;
      const c = s.game.canvas;
      const r = c.getBoundingClientRect();
      const k = r.width / c.width;
      return { x: r.left + (x - cam.scrollX) * cam.zoom * k, y: r.top + (y - cam.scrollY) * cam.zoom * k };
    },
    { x, y },
  );

const expectEq = (what, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};

const creation = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/creation.json'), 'utf8'));
const N = creation.narrator;
const FACINGS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
/** A name the safe-letters filter refuses, built from its data's alphabet positions (never spelled out). */
const safeLetters = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/safe-letters.json'), 'utf8'));
const filtered = safeLetters.latin.runs[0].map((p) => String.fromCharCode(97 + p)).join('');

// The layout's points (UI px), as CreationScene draws them.
const MARGIN = 16;
const CARD_W = Math.floor((480 - 2 * MARGIN - 3 * 6) / 4);
const cardCentre = (i) => ({ x: MARGIN + i * (CARD_W + 6) + CARD_W / 2, y: 70 });
const swatchCentre = (i) => ({ x: MARGIN + 12 + i * 56 + 12, y: 56 + 12 });
const FIGURE = { x: 356, y: 150 };

const username = `make${Date.now() % 100000}`;
const password = 'correct horse battery';

await page.goto(BASE);
await waitScene('account');
const reg = await api('/api/register', { username, password });
expectEq('registered', reg.status, 201);
await page.reload();
await waitScene('creation');

// 1. The opening on black.
console.log('the opening:');
let s = await until((x) => x.phase === 'opening', 'the opening');
expectEq('the opening line', s.narrator, N.opening);
await shot('01-opening', 400);
s = await until((x) => x.phase === 'remembrance', 'Remembrance after openingMs', 100, 100);

// 2. Remembrance: Tide clicked, the focus on NEXT, the card still hovered: the hover line.
console.log('Remembrance:');
expectEq('the first card focused', s.focus, 'cards');
expectEq('the line with the cards focused', s.narrator, N.remembrance);
const tide = await toPage(cardCentre(2).x, cardCentre(2).y);
await page.mouse.click(tide.x, tide.y);
await until((x) => x.remembrance === 'tide', 'Tide chosen');
await page.keyboard.press('Tab');
s = await until((x) => x.focus === 'next', 'NEXT focused');
expectEq('the hover line (the card under the pointer)', s.narrator, N.remembrance);
expectEq("Ash's sheet until Tide's lands", s.sheet, existsSync(join(ROOT, 'packages/shared/assets/sprites/kindled-tide-sheathed.json')) ? 'kindled-tide-sheathed' : 'kindled-ash-sheathed');
await shot('02-remembrance-hover');
// Off the card, with the focus on NEXT: no line.
await page.mouse.move(5, 5);
await until((x) => x.narrator === null, 'no line off the cards');

// 3. Appearance: the red tone, the figure mid-turn, the tones' line.
console.log('Appearance:');
await page.keyboard.press('Enter');
s = await until((x) => x.phase === 'appearance', 'Appearance');
expectEq('BACK keeps Tide', s.remembrance, 'tide');
const red = await toPage(swatchCentre(2).x, swatchCentre(2).y);
await page.mouse.click(red.x, red.y);
s = await until((x) => x.tone === 'clay-red', 'the red tone');
expectEq('the tones focused', s.focus, 'tones');
expectEq("the tones' line", s.narrator, N.appearance);
s = await until((x) => x.facing === 'E', 'the figure turning to E', 200, 20);
expectEq('turning by itself', s.manualTurn, false);
await shot('03-appearance-turning', 30);

// 3b. Turned by hand: a drag across the figure (two facings), then Left/Right to face west; the turning paused.
console.log('turned by hand:');
const fig = await toPage(FIGURE.x, FIGURE.y);
const pxPerUi = (await toPage(FIGURE.x + 1, FIGURE.y)).x - fig.x;
const before = FACINGS.indexOf((await snap()).facing);
await page.mouse.move(fig.x, fig.y);
await page.mouse.down();
await page.mouse.move(fig.x + 50 * pxPerUi, fig.y, { steps: 10 });
await page.mouse.up();
s = await until((x) => x.manualTurn, 'turned by a drag');
expectEq('the figure row focused', s.focus, 'figure');
const dragged = FACINGS.indexOf(s.facing);
if ((dragged - before + 8) % 8 !== 2 && (dragged - before + 8) % 8 !== 3)
  throw new Error(`a 50 px drag turned ${FACINGS[before]} to ${s.facing}`);
console.log(`  dragged ${FACINGS[before]} → ${s.facing}`);
let delta = (6 - dragged + 8) % 8;
const key = delta <= 4 ? 'ArrowRight' : 'ArrowLeft';
if (delta > 4) delta = 8 - delta;
for (let i = 0; i < delta; i++) await page.keyboard.press(key);
await until((x) => x.facing === 'W', 'facing west');
await page.mouse.move(5, 5);
await sleep(1500);
s = await snap();
expectEq('still west: the turning paused', [s.facing, s.manualTurn], ['W', true]);
expectEq('no line on the figure row', s.narrator, null);
await shot('03b-turned-west');

// 4. Name: the empty-field line.
console.log('Name:');
await page.keyboard.press('Enter');
s = await until((x) => x.phase === 'name', 'Name');
expectEq('the field focused', s.focus, 'field');
expectEq('the empty-field line', s.narrator, N.nameEmpty);
expectEq('the choices kept', [s.remembrance, s.tone], ['tide', 'clay-red']);
await shot('04-name-empty');

// 5. A name the filter refuses: LORE's line under the field, the step stays. The server says the same.
console.log('refused:');
const refusedByApi = await api('/api/kindled', { name: filtered, remembrance: 'tide', clayTone: 'clay-red' });
expectEq('the API refuses with the same line', refusedByApi, { status: 400, body: { error: 'name-refused', message: creation.refused } });
await page.keyboard.type(filtered);
await until((x) => x.narrator === null, 'no line once typed');
await page.keyboard.press('Enter');
s = await until((x) => x.error !== '', 'the refusal');
expectEq("LORE's refusal", [s.phase, s.error], ['name', creation.refused]);
// Clear the field before the shot: the refusal stays until the next CONFIRM.
await page.keyboard.press('Control+A');
await page.keyboard.press('Backspace');
s = await until((x) => x.narrator === N.nameEmpty, 'the field empty again');
expectEq('the refusal kept', s.error, creation.refused);
await shot('05-name-refused');

// 6. A good name: the closing line on black.
console.log('closing:');
await page.keyboard.type('Iltani');
await page.keyboard.press('Enter');
s = await until((x) => x.phase === 'closing', 'the closing', 100, 30);
expectEq('the closing line', s.narrator, N.closing);
await shot('06-closing', 300);

// 7. The start screen with the Kindled made.
console.log('the start screen:');
await waitScene('start');
const me = await api('/api/me');
expectEq('the Kindled', me.body.kindled && { name: me.body.kindled.name, remembrance: me.body.kindled.remembrance, clayTone: me.body.kindled.clayTone }, {
  name: 'Iltani',
  remembrance: 'tide',
  clayTone: 'clay-red',
});
console.log(`  ${JSON.stringify(me.body.kindled)}`);
await shot('07-start', 800);

await browser.close();
console.log('done');
