#!/usr/bin/env node
/**
 * M2 Task 4b end to end (docs/screenshots/m2-4b): Old Kesh, across the
 * water. A new account and Kindled land on the holding and walk to the Talk
 * spot: Kesh fishing on his rock, clear of the HUD at 1440 × 810 (the camera
 * margin), the TALK prompt. Talk with his first sliver due plays the toss
 * first (LORE's "First one's free."): the sliver mid-flight, then "+1" where
 * it lands and PACK 1/20; the hint; then the menu, and a topic with Kesh's
 * `talk` row playing. Naming the island plays LORE's after-naming lines (then
 * the Writ panel), feeding the sliver plays the after-first-feeding line.
 * The tide's sliver is taken on the same account (the first doesn't use up
 * the tide's), then `kesh:reset` makes the first due again. Every state is
 * checked through the API and the scene's snapshot. Shots are whole-page
 * screenshots at 1280 × 720, the first at 1440 × 810.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-4b.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-4b'));
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
const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
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

async function shot(name, settle = 300) {
  await sleep(settle);
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
async function until(pred, what, tries = 100, every = 100) {
  for (let i = 0; i < tries; i++) {
    const h = await holding();
    if (h && pred(h)) return h;
    await sleep(every);
  }
  const last = await holding();
  const seen = last ? { prompt: last.promptLabel, panel: last.panel, talk: last.talk, kesh: last.kesh, writPanel: last.writPanel?.state, at: [last.state.x, last.state.y] } : null;
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

/** Click a line of text (a topic row of the talk box) on the holding's UI camera. */
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

const username = `kesh${Date.now() % 100000}`;
const cli = (script, ...args) => {
  const out = execFileSync('pnpm', ['--silent', '--filter', '@iot/server', script, '--', username, ...args], { cwd: ROOT, encoding: 'utf8' });
  console.log(`  ${out.trim()}`);
};
const expectEq = (what, got, want) => {
  if (got !== want) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};

/** The layout's points (sim px), from the data. */
const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8')).layouts[0];
const kesh = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/kesh.json'), 'utf8'));
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const talkSpot = centre(layout.kesh.talk);
const postUse = centre(layout.stations.find((s) => s.id === 'writ-post').parts[0].interact);
const firstLine = kesh.topics.find((t) => t.id === 'sparkglass').lines.find((l) => l.only === 'first-sliver');

/** Walk to the Talk spot and wait for the TALK prompt. */
async function toKesh() {
  await walkTo(talkSpot.x, talkSpot.y);
  return until((x) => x.promptLabel === 'TALK', 'the TALK prompt at the Talk spot');
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
expectEq('the first sliver is due', h.response.kesh.due, 'first');
expectEq('nothing given yet', h.response.kesh.firstGiven, false);
console.log(`  next tide at ${h.response.kesh.nextTideAt}`);

// 1. The Kindled at the Talk spot with Kesh fishing, the rock clear of the HUD at 1440 × 810 (the camera margin).
console.log('across the water:');
h = await toKesh();
expectEq('Kesh fishes', h.kesh.row, 'fish');
console.log(`  Kesh ${h.kesh.row}/${h.kesh.frame}, camera scroll ${JSON.stringify(h.scroll)}`);
await shot('01-talk-spot-fishing');
// 2. The TALK prompt, at the usual 1280 × 720 from here on.
await page.setViewportSize({ width: 1280, height: 720 });
await until((x) => x.promptLabel === 'TALK', 'the TALK prompt after the resize');
await shot('02-prompt-talk');

// 3–6. Talk with the first sliver due: the due toss first. A slower toss for the mid-flight shot (tuning, as the F2 panel would set it).
console.log('the first sliver:');
await page.evaluate(() => {
  const t = window.__iot.tuning.get();
  window.__iot.tuning.set({ ...t, kesh: { ...t.kesh, tossMs: 2400 } });
});
await page.keyboard.press('KeyE');
h = await until((x) => x.talk?.kind === 'line', 'the talk box');
expectEq('the first-sliver line', h.talk.text, firstLine.text);
expectEq('Kesh speaks it', h.talk.speaker, 'Kesh');
h = await until((x) => x.kesh.flight !== null, 'the sliver in the air', 100, 30);
console.log(`  mid-flight at ${JSON.stringify(h.kesh.flight)}, Kesh ${h.kesh.row}/${h.kesh.frame}`);
await page.screenshot({ path: join(OUT, '05-toss-mid-flight.png') });
console.log('  05-toss-mid-flight.png');
h = await until((x) => x.floats.includes('+1'), 'the "+1" where it landed', 200, 30);
let r = await api('/api/inventory');
expectEq('one sliver in the pack', r.body.pack.find((e) => e.itemId === 'wild-sliver')?.quantity, 1);
expectEq('the first is given', h.response.kesh.firstGiven, true);
expectEq("the tide's is still due", h.response.kesh.due, 'tide');
await page.screenshot({ path: join(OUT, '06-landed-plus-one-pack.png') });
console.log('  06-landed-plus-one-pack.png (PACK 1/20)');
await page.evaluate(() => {
  window.__iot.tuning.reset();
});
// The hint, then the menu.
await page.keyboard.press('KeyE');
h = await until((x) => x.talk?.who === 'hint', 'the hint');
expectEq('the hint', h.talk.text, 'Touch Sparkglass to your Writ to feed it.');
expectEq('no speaker on a hint', h.talk.speaker, null);
await page.keyboard.press('KeyE');
h = await until((x) => x.talk?.kind === 'menu', 'the menu');
expectEq('the topics', h.talk.topics.join('|'), 'The Old Letters|Sparkglass|Where the crack points|Goodbye');
console.log('the menu:');
await shot('03-menu');
// 4. A topic: Kesh's line with `talk` playing.
await clickText('The Old Letters');
h = await until((x) => x.talk?.kind === 'line' && x.kesh.row === 'talk', 'a Kesh line with talk playing');
expectEq('the first Old Letters line', h.talk.text, kesh.topics[0].lines[0].text);
console.log(`  Kesh ${h.kesh.row}/${h.kesh.frame}: ${h.talk.text.slice(0, 40)}...`);
await shot('04-kesh-line-talking');
// Through the topic back to the menu; Esc closes at any step.
for (let i = 0; i < 7; i++) await page.keyboard.press('KeyE');
await until((x) => x.talk?.kind === 'menu', 'back on the menu');
// The Sparkglass topic no longer carries the first-sliver step (7 lines, no toss).
await clickText('Sparkglass');
h = await until((x) => x.talk?.kind === 'line', 'the Sparkglass topic');
expectEq('seven lines once the first is given', h.talk.count, 7);
await page.keyboard.press('Escape');
await until((x) => x.talk === null, 'the box closed');
expectEq('Kesh fishes again', (await holding()).kesh.row, 'fish');

// 7. After naming: LORE's lines, then the Writ panel.
console.log('after naming:');
await walkTo(postUse.x, postUse.y);
await until((x) => x.promptLabel === 'USE', 'the USE prompt at the post');
await page.keyboard.press('KeyE');
await until((x) => x.nameScreen !== null, 'the Name screen');
await page.keyboard.type('Black Rock', { delay: 40 });
await until((x) => x.nameScreen?.letters === 'בלק רוק', 'the tablet heard the Name');
await page.keyboard.press('Enter');
h = await until((x) => x.talk?.kind === 'line', 'the after-naming lines', 100);
expectEq('Kesh squints at the post', h.talk.text, kesh.afterNaming[0].text);
expectEq('his talk row', h.kesh.row, 'talk');
await shot('07-after-naming');
await page.keyboard.press('KeyE');
h = await until((x) => x.talk?.who === 'narrator', 'the Narrator');
expectEq('the Narrator', h.talk.text, kesh.afterNaming[1].text);
await page.keyboard.press('KeyE');
await until((x) => x.talk?.who === 'hint', 'the hint');
await page.keyboard.press('KeyE');
await until((x) => x.talk === null && x.writPanel !== null, 'the Writ panel after the lines');

// 8. The first feeding: the sliver from Kesh, fed; LORE's line.
console.log('the first feeding:');
await until((x) => x.writPanel?.feedOn === true, 'the sliver in the panel');
await clickButton('FEED ONE');
h = await until((x) => x.talk?.kind === 'line', 'the after-first-feeding line');
expectEq('the line', h.talk.text, kesh.afterFirstFeeding[0].text);
expectEq('fed_at set', typeof h.response.writ.fedAt, 'string');
await shot('08-after-first-feeding');
await page.keyboard.press('KeyE');
await until((x) => x.talk === null, 'the box closed');
// A second feed plays nothing.
cli('inv:grant', 'wild-sliver', '1', 'pack');
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');
await walkTo(postUse.x, postUse.y);
await page.keyboard.press('KeyE');
await until((x) => x.writPanel?.feedOn === true, 'the panel with a sliver');
await clickButton('FEED ONE');
await until((x) => x.response?.writ.words === 'about six days', 'the second feed landed');
await sleep(400);
expectEq('no line on the second feed', (await holding()).talk, null);
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');

// 9. The tide's sliver, on the same account: the first doesn't use up the tide's (GAME DESIGN), so it is due now.
console.log("the tide's sliver:");
h = await toKesh();
expectEq("the tide's is due", h.response.kesh.due, 'tide');
await page.keyboard.press('KeyE');
h = await until((x) => x.talk?.kind === 'line', 'the tide line');
expectEq('the tide line', h.talk.text, kesh.tideSliver[0].text);
await until((x) => x.kesh.row === 'toss' || x.kesh.flight !== null, 'the toss', 100, 30);
await page.screenshot({ path: join(OUT, '09-tide-sliver.png') });
console.log('  09-tide-sliver.png');
await until((x) => x.floats.includes('+1'), 'the "+1"', 200, 30);
r = await api('/api/inventory');
expectEq('one sliver in the pack again', r.body.pack.find((e) => e.itemId === 'wild-sliver')?.quantity, 1);
await until((x) => x.response?.kesh.due === null, 'nothing more due this tide');
await page.keyboard.press('KeyE');
await until((x) => x.talk?.kind === 'menu', 'the menu');
await page.keyboard.press('Escape');
await until((x) => x.talk === null, 'the box closed');
// Not due again: the route refuses; Talk opens on the menu.
const refused = await api('/api/kesh/sliver', {});
expectEq('not-due', refused.body.error, 'not-due');
await page.keyboard.press('KeyE');
await until((x) => x.talk?.kind === 'menu', 'the menu straight away');
await page.keyboard.press('Escape');
await until((x) => x.talk === null, 'the box closed');
// kesh:reset: the first is due again.
cli('kesh:reset');
r = await api('/api/holding');
expectEq('the first due again after the reset', r.body.kesh.due, 'first');
expectEq('firstGiven cleared', r.body.kesh.firstGiven, false);
console.log(`  after kesh:reset: ${JSON.stringify(r.body.kesh)}`);

await browser.close();
