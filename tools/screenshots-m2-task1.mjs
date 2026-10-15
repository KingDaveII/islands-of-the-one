#!/usr/bin/env node
/**
 * Historical (M1/M2): this script assumes M1's 480 × 270 canvas at a CSS
 * zoom. Since G1.5 (the canvas at device resolution, a world and a UI camera)
 * it no longer runs as-is; its shots stay the record of their task.
 * tools/screenshots-g15.mjs is the current script.
 *
 * Accounts and Kindled creation (docs/screenshots/m2-task1), and the M2
 * Task 1 end-to-end check in a fresh browser: create an account (after one
 * refused try), create a Kindled (each Remembrance, a tone swap, a refused
 * and an undrawable name, then an accented one), reload and still be signed
 * in, log out, log back in. The fields are real inputs in a real form (their
 * autocomplete attributes are checked); a last shot is a phone in landscape. Needs the dev stack running
 * (`pnpm dev`: the client on :5173 proxies /api to the server); the shots
 * are game pixels at zoom 3.
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-task1.mjs [outDir] [baseUrl]
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-task1'));
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
// A fresh context: no cookies.
const context = await browser.newContext({
  viewport: { width: 480 * ZOOM, height: 270 * ZOOM },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));

/** The active scene keys. */
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
  await sleep(150);
  await page.locator('#game canvas').screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

const press = async (key, times = 1) => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};

const username = `kindled${Date.now() % 100000}`;
const password = 'correct horse battery';

/** The form's inputs as the page has them (a real form, for password managers). */
const formState = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('form.game-form input')].map((i) => ({
      name: i.name,
      type: i.type,
      autocomplete: i.autocomplete,
      focused: document.activeElement === i,
    })),
  );
function expectEqual(what, got, want) {
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error(`${what}: ${JSON.stringify(got)} !== ${JSON.stringify(want)}`);
}

await page.goto(BASE);
await waitScene('account');
console.log('fresh browser: account scene');
expectEqual('log-in form', await formState(), [
  { name: 'username', type: 'text', autocomplete: 'username', focused: true },
  { name: 'password', type: 'password', autocomplete: 'current-password', focused: false },
]);
await page.keyboard.type(username);
await press('Tab');
await page.keyboard.type(password);
await shot('01-log-in');

// Log in to an account that doesn't exist yet: refused.
await press('Enter');
await sleep(800);
await shot('02-log-in-refused');

// Create account: a username that breaks the rules first.
await press('ArrowUp', 2);
await press('ArrowRight');
expectEqual('create-account password', (await formState())[1]?.autocomplete, 'new-password');
await press('Tab');
await press('Backspace', 30);
await page.keyboard.type('no');
await press('Enter');
await sleep(200);
await shot('03-create-account-error');

await press('Backspace', 5);
await page.keyboard.type(username);
await press('Enter');
await waitScene('creation');
console.log(`created account ${username}: creation scene`);

for (const [i, r] of ['clay', 'ash', 'tide', 'wing'].entries()) {
  await shot(`${String(4 + i).padStart(2, '0')}-creation-${r}`);
  if (i < 3) await press('ArrowRight');
}

await press('ArrowDown');
for (const [i, tone] of ['pale', 'red', 'river-dark'].entries()) {
  await press('ArrowRight');
  await sleep(300);
  await shot(`${String(8 + i).padStart(2, '0')}-tone-${tone}`);
}

// A refused name, a name the fonts can't draw yet (entered as IME or paste would), then a good one.
await press('ArrowDown');
await page.keyboard.type('M');
await press('Enter');
await sleep(200);
await shot('11-name-refused');
await press('Backspace');
await page.keyboard.insertText(`Mira ${String.fromCodePoint(0x5de, 0x5d9, 0x5e8, 0x5d4)}`);
await press('Enter');
await sleep(200);
await shot('12-name-not-drawable');
for (let i = 0; i < 12; i++) await press('Backspace');
const kindledName = `Zo${String.fromCodePoint(0xeb)} of the Shore`;
await page.keyboard.insertText(kindledName);
await shot('13-name-typed');
await press('Enter');
await waitScene('start');
await shot('14-start-signed-in');
const me = await page.evaluate(() => fetch('/api/me').then((r) => r.json()));
expectEqual('stored name', me.kindled?.name, kindledName);
console.log(`Kindled ${kindledName} created: start screen`);

await page.reload();
await waitScene('start');
console.log('reload: still signed in');

await press('Escape');
await waitScene('account');
console.log('logged out: account scene');

await page.keyboard.type(username);
await press('Tab');
await page.keyboard.type(password);
await press('Enter');
await waitScene('start');
console.log('logged back in: start screen');
const cookies = await context.cookies();
const session = cookies.find((c) => c.name === 'iot_session');
console.log(
  `session cookie: httpOnly=${session?.httpOnly} sameSite=${session?.sameSite} path=${session?.path}`,
);

// After a run the game's keys are released: W/A/S/D type into the username field again.
await page.evaluate(() => window.__iot.startRun(7));
await waitScene('game');
await sleep(500);
await page.evaluate(() => {
  const game = window.__iot.game;
  game.scene.getScenes(true).forEach((sc) => game.scene.stop(sc.scene.key));
  game.scene.start('start');
});
await waitScene('start');
await press('Escape');
await waitScene('account');
await page.keyboard.type('wasd');
expectEqual(
  'typed after a run',
  await page.evaluate(() => document.querySelector('#game-input-username').value),
  'wasd',
);
console.log('after a run: the username field takes W/A/S/D');

// A phone in landscape (844 x 390 CSS px at DPR 3): 4 device px per game px, a 1.33 CSS px zoom.
const phone = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const phonePage = await phone.newPage();
await phonePage.goto(BASE);
for (let i = 0; i < 100; i++) {
  const keys = await phonePage.evaluate(() =>
    window.__iot.game.scene.getScenes(true).map((s) => s.scene.key),
  );
  if (keys.includes('account')) break;
  await sleep(100);
}
await phonePage.locator('#game-input-username').tap();
await phonePage.keyboard.type('kindled');
await sleep(150);
await phonePage.locator('#game canvas').screenshot({ path: join(OUT, '15-phone-landscape.png') });
const font = await phonePage.evaluate(() => {
  const i = document.querySelector('#game-input-username');
  return { fontSize: getComputedStyle(i).fontSize, dpr: window.devicePixelRatio };
});
console.log(`  15-phone-landscape.png (input font ${font.fontSize} at DPR ${font.dpr})`);
await phone.close();

await browser.close();
