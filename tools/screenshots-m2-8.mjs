#!/usr/bin/env node
/**
 * M2 Task 8 end to end (docs/screenshots/m2-8): the weapon rack. A new
 * account and Kindled land on the holding; the first holding request gives
 * the kit (the Hookblade, onto the rack). The rack stands beside the post (a
 * placeholder box until ART's `prop-weapon-rack` lands) with the USE prompt;
 * Use opens the rack panel: the title, LORE's tooltip line, the Hookblade's
 * row with its card, its kit line and Taken. A refusal shows in the footer
 * (the Keelmaul chosen through the scene's call, which the server refuses as
 * not-owned; the route refuses it the same way). The start screen shows the
 * chosen weapon with "Taken from your weapon rack." and START RUN starts the
 * run with it (the run record's weapon). Kesh's "The rack" topic plays its
 * three lines. Every state is checked through the API and the scene's
 * snapshot (`rackPanel`, `talk` on `window.__iot.holding()`). Shots are
 * whole-page screenshots at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-8.mjs [outDir] [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-8'));
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
    ? { prompt: last.promptLabel, panel: last.panel, rackPanel: last.rackPanel, talk: last.talk, at: [last.state.x, last.state.y] }
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

const username = `rack${Date.now() % 100000}`;
const password = 'correct horse battery';
const expectEq = (what, got, want) => {
  if (got !== want) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};

/** The layout's points (sim px) and the texts, from the data. */
const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8')).layouts[0];
const items = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/items.json'), 'utf8')).items;
const kesh = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/kesh.json'), 'utf8'));
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const station = (id) => layout.stations.find((s) => s.id === id);
const rack = station('weapon-rack');
const rackUse = centre(rack.parts[0].interact);
const talkSpot = centre(layout.kesh.talk);
const hookblade = items.find((i) => i.id === 'hookblade');
const rackTopic = kesh.topics.find((t) => t.id === 'rack');
const TOOLTIP = 'Every weapon you own hangs here. Take one out with you; the others wait.';
const FROM_RACK = 'Taken from your weapon rack.';
const NOT_OWNED = "That one isn't hanging on your rack.";

/** Log in and land on the holding (a reload, the start screen's main action). */
async function land() {
  await page.reload();
  await waitScene('start');
  await page.keyboard.press('Enter');
  await waitScene('holding');
  return until((x) => x.response !== null, 'the holding answered');
}

/** The start screen's weapon and line, once the holding has answered it. */
const startWeapon = () =>
  page.evaluate(() => {
    const s = window.__iot.game.scene.getScene('start');
    return { weapon: s.weapon, line: s.weaponLine };
  });

await page.goto(BASE);
await waitScene('account');
const setup = await page.evaluate(
  async ({ username, password }) => {
    const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const reg = await post('/api/register', { username, password });
    const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
    return [reg.status, k.status];
  },
  { username, password },
);
if (setup.join() !== '201,201') throw new Error(`setup failed: ${setup.join()}`);
// Before any holding request: no weapon. The first one gives the kit.
let r = await api('/api/inventory');
expectEq('nothing held yet', JSON.stringify(r.body), JSON.stringify({ purse: [], pack: [], store: [], baskets: {} }));
let h = await land();
expectEq('the kit on the rack, chosen', JSON.stringify(h.response.rack), JSON.stringify({ weapons: [{ itemId: 'hookblade', ready: true }], chosen: 'hookblade' }));
r = await api('/api/inventory');
expectEq('the weapon is not in the panes', r.body.store.length + r.body.pack.length, 0);

// 1. The rack beside the post (the placeholder box, or ART's sheet once it has landed) with the USE prompt.
console.log('the rack:');
const prop = h.props.find((p) => p.stationId === 'weapon-rack');
if (!prop) throw new Error('no prop for the rack');
console.log(`  drawn from ${prop.sheet}`);
if (!(prop.sheet === 'prop-weapon-rack' || prop.sheet.startsWith('placeholder:'))) throw new Error(`the rack draws as ${prop.sheet}`);
await walkTo(rackUse.x, rackUse.y);
h = await until((x) => x.promptLabel === 'USE' && x.prompt, 'the USE prompt at the rack');
expectEq('no panel yet', h.rackPanel, null);
await shot('01-rack-beside-the-post');

// 2. Use: the panel, the Hookblade's row, Taken, its kit line.
await page.keyboard.press('KeyE');
h = await until((x) => x.rackPanel !== null && x.rackPanel.rows.length > 0, 'the rack panel');
expectEq('the title', h.rackPanel.title, 'Weapon rack');
expectEq("LORE's tooltip line", h.rackPanel.tooltip, TOOLTIP);
expectEq('one row', h.rackPanel.rows.length, 1);
const row = h.rackPanel.rows[0];
expectEq('the Hookblade', row.name, 'Hookblade');
expectEq("LORE's card", row.card, hookblade.description);
expectEq('the kit line', row.kit, 'Arc · Hook-thrust · Haul');
expectEq('Taken', row.stateText, 'Taken');
expectEq('no TAKE button on the taken weapon', row.button, null);
expectEq('the Kindled stands still', h.prompt, false);
await shot('02-rack-panel-hookblade-taken');

// 3. A refusal in the footer: the Keelmaul isn't on the rack (not-owned). The route says the same.
console.log('a refusal:');
r = await api('/api/holding/rack/choose', { weaponId: 'keelmaul' });
expectEq('the route refuses it', r.status, 409);
expectEq('not-owned', r.body.error, 'not-owned');
expectEq('its line', r.body.message, NOT_OWNED);
r = await api('/api/holding/rack/choose', { weaponId: 'hookblade', extra: 1 });
expectEq('a malformed body', r.body.error, 'bad-request');
await page.evaluate(() => {
  window.__iot.holdingScene().chooseWeapon('keelmaul');
});
await until((x) => x.rackPanel?.result === NOT_OWNED, 'the refusal in the footer');
// Past the two blinks (300 ms), into the 2 s hold.
await sleep(400);
h = await until((x) => x.rackPanel?.result === NOT_OWNED, 'the refusal held', 20, 50);
expectEq('the row unchanged', h.rackPanel.rows[0].stateText, 'Taken');
await shot('03-rack-refusal-not-owned', 0);

// 4. The start screen: the chosen weapon, LORE's line under it; no picker.
console.log('the start screen:');
await page.keyboard.press('Escape');
await until((x) => x.rackPanel === null, 'the panel closed');
await page.keyboard.press('Escape');
await waitScene('start');
const sw = await untilTrue(async () => {
  const s = await startWeapon();
  return s.line === FROM_RACK ? s : null;
}, 'the start screen read the rack');
expectEq('the weapon', sw.weapon, 'hookblade');
await shot('04-start-screen-taken-from-the-rack');

// 4b. Kesh's "The rack" topic: his three lines, word for word, then the menu again.
console.log("Kesh's topic:");
// Both slivers taken through the API, so Talk opens on the menu.
expectEq('the first sliver', (await api('/api/kesh/sliver', {})).status, 200);
expectEq("the tide's", (await api('/api/kesh/sliver', {})).status, 200);
await page.keyboard.press('Enter');
await waitScene('holding');
await until((x) => x.response !== null, 'the holding answered');
await walkTo(talkSpot.x, talkSpot.y);
await until((x) => x.promptLabel === 'TALK', 'the TALK prompt');
await page.keyboard.press('KeyE');
h = await until((x) => x.talk?.kind === 'menu', 'the menu');
expectEq('the topics', h.talk.topics.join('|'), 'The Old Letters|Sparkglass|Where the crack points|The rack|Goodbye');
for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
await until((x) => x.talk?.focus === 3, 'The rack focused');
await page.keyboard.press('Enter');
h = await until((x) => x.talk?.kind === 'line' && x.talk.text === rackTopic.lines[0].text, "Kesh's first rack line");
expectEq('Kesh speaks it', h.talk.speaker, 'Kesh');
expectEq('three lines', h.talk.count, 3);
await shot('04b-kesh-the-rack');
await page.keyboard.press('Enter');
h = await until((x) => x.talk?.index === 1, 'the second line');
expectEq('the second line', h.talk.text, rackTopic.lines[1].text);
await page.keyboard.press('Enter');
h = await until((x) => x.talk?.index === 2, 'the third line');
expectEq('the third line', h.talk.text, rackTopic.lines[2].text);
await page.keyboard.press('Enter');
await until((x) => x.talk?.kind === 'menu' && x.talk.focus === 3, 'back on the menu');
await page.keyboard.press('Escape');
await until((x) => x.talk === null, 'the box closed');

// 5. A run started from the start screen with that weapon: the run record's weapon.
console.log('the run:');
await page.keyboard.press('Escape');
await waitScene('start');
await untilTrue(async () => (await startWeapon()).line === FROM_RACK, 'the start screen read the rack again');
await page.keyboard.down('Shift');
await page.keyboard.press('Enter');
await page.keyboard.up('Shift');
await waitScene('game');
const record = await untilTrue(() => page.evaluate(() => window.__iot.record()), 'the run record');
expectEq("the run's weapon", record.weapon, 'hookblade');
console.log(`  run seed ${record.seed}, weapon ${record.weapon}`);
await shot('05-run-with-the-hookblade', 800);

await browser.close();
