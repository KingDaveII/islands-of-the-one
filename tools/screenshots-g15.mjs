#!/usr/bin/env node
/**
 * G1.5 reference shots (docs/screenshots/g15): the world at 2× and the UI on
 * its own grid, at six window sizes, each a whole page screenshot in device
 * pixels. Per size: the start screen, the account form with its inputs
 * typed in, a run in a fight with the HUD, and the inventory. Also checks
 * that the DOM inputs sit inside their field panels and that a click on a
 * menu button lands through the centred UI camera.
 *
 * Needs the dev stack (`pnpm dev`, on Postgres with DATABASE_URL set: the
 * inventory grant goes through the CLI). `--only <prefix>` takes the shots
 * of one size; `--m1 <baseUrl> <name>` takes the 1920 × 912 fight shot from
 * another client (main before G1.5) as `<name>.png`.
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-g15.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const m1 = (() => {
  const i = args.indexOf('--m1');
  if (i < 0) return null;
  const [, base, name] = args.splice(i, 3);
  return { base, name };
})();
const only = flag('--only');
const OUT = resolve(args[0] ?? join(ROOT, 'docs/screenshots/g15'));
const BASE = args[1] ?? 'http://localhost:5173';

/** The window sizes of the brief: CSS size at a device pixel ratio. */
const SIZES = [
  { name: '1920x912@1', width: 1920, height: 912, dpr: 1 },
  { name: '1536x714@1.25', width: 1536, height: 714, dpr: 1.25 },
  { name: '1366x650@1', width: 1366, height: 650, dpr: 1 },
  { name: '2560x1300@1', width: 2560, height: 1300, dpr: 1 },
  { name: '3840x2050@1', width: 3840, height: 2050, dpr: 1 },
  { name: '844x390@3', width: 844, height: 390, dpr: 3 },
];

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

const scenesOf = (page) =>
  page.evaluate(() => window.__iot?.game.scene.getScenes(true).map((s) => s.scene.key) ?? []);

async function waitScene(page, key) {
  for (let i = 0; i < 100; i++) {
    if ((await scenesOf(page)).includes(key)) return;
    await sleep(100);
  }
  throw new Error(`scene ${key} never started (active: ${(await scenesOf(page)).join(', ')})`);
}

async function shot(page, name) {
  await sleep(250);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  ${name}.png`);
}

/** One account with a Kindled and a few items, shared by every size (its cookie is reused). */
async function setUpAccount() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(BASE);
  await waitScene(page, 'account');
  const username = `wide${Date.now() % 100000}`;
  const status = await page.evaluate(async (username) => {
    const post = (url, body) =>
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const reg = await post('/api/register', { username, password: 'correct horse battery' });
    const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'ash' });
    return [reg.status, k.status];
  }, username);
  if (status.join() !== '201,201') throw new Error(`setup failed: ${status.join()}`);
  for (const [item, n] of [
    ['sealed-gin', '120'],
    ['wild-sliver', '4'],
    ['glass-chip', '2'],
    ['twisted-log', '5'],
    ['black-stone', '30'],
    ['pale-grain', '14'],
  ]) {
    execFileSync('pnpm', ['--silent', '--filter', '@iot/server', 'inv:grant', username, item, n], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  }
  const state = await context.storageState();
  await context.close();
  return { username, state };
}

/** Click a menu button by its label, through the main camera (layout px → device px → CSS px). */
async function clickButton(page, sceneKey, text) {
  const at = await page.evaluate(
    ({ sceneKey, text }) => {
      const scene = window.__iot.game.scene.getScene(sceneKey);
      const found = scene.children.list
        .filter((o) => o.type === 'Container')
        .flatMap((c) => c.list.map((child) => ({ c, child })))
        .find(({ child }) => child.text === text);
      if (!found) return null;
      const b = found.c.getBounds();
      const cam = scene.cameras.main;
      const canvas = window.__iot.game.canvas;
      const r = canvas.getBoundingClientRect();
      const css = r.width / canvas.width;
      return {
        x: r.left + (cam.x + (b.centerX - cam.scrollX) * cam.zoom) * css,
        y: r.top + (cam.y + (b.centerY - cam.scrollY) * cam.zoom) * css,
      };
    },
    { sceneKey, text },
  );
  if (!at) throw new Error(`no ${text} button`);
  await page.mouse.click(at.x, at.y);
}

/** The inputs' boxes against their field panels' (CSS px): each input must sit inside its panel. */
async function checkInputs(page) {
  const result = await page.evaluate(() => {
    const scene = window.__iot.game.scene.getScene('account');
    const cam = scene.cameras.main;
    const canvas = window.__iot.game.canvas;
    const r = canvas.getBoundingClientRect();
    const css = r.width / canvas.width;
    const toCss = (x, y) => ({
      x: r.left + (cam.x + (x - cam.scrollX) * cam.zoom) * css,
      y: r.top + (cam.y + (y - cam.scrollY) * cam.zoom) * css,
    });
    return Object.entries(scene.frames).map(([name, frame]) => {
      const b = frame.box;
      const a = toCss(b.x, b.y);
      const z = toCss(b.x + b.w, b.y + b.h);
      const input = document.querySelector(`#game-input-${name}`).getBoundingClientRect();
      const inside = input.left >= a.x && input.right <= z.x && input.top >= a.y && input.bottom <= z.y;
      return { name, inside, fontPx: parseFloat(getComputedStyle(document.querySelector(`#game-input-${name}`)).fontSize) * devicePixelRatio };
    });
  });
  for (const f of result) {
    if (!f.inside) throw new Error(`the ${f.name} input is outside its panel`);
  }
  return result.map((f) => `${f.name} ${f.fontPx} device px`).join(', ');
}

/** A run with the autopilot until the fight is on (a Husk hit, the HUD changing), then frozen for the shot. */
async function fight(page, seed = 7) {
  await page.evaluate((seed) => window.__iot.startRun(seed), seed);
  await waitScene(page, 'game');
  await page.evaluate(() => window.__iot.setAutopilot({}));
  for (let i = 0; i < 400; i++) {
    const ready = await page.evaluate(() => {
      const s = window.__iot.scene()?.session.state;
      if (!s) return false;
      const hostiles = s.husks.filter((h) => h.action !== 'spawn' && h.core > 0);
      const hurt = s.husks.some((h) => h.shell.some((v) => v <= 0) || h.action === 'flinch');
      // The player solid (not flickering through i-frames or the post-hit grace).
      const solid = s.player.iframes === 0 && s.player.hurtInvuln === 0;
      return hostiles.length >= 2 && hurt && s.player.hp < 100 && solid;
    });
    if (ready) break;
    await sleep(100);
  }
  await page.evaluate(() => window.__iot.setSpeed(0));
}

async function sizeShots(size, account) {
  console.log(`${size.name}:`);
  const viewport = { width: size.width, height: size.height };
  // Signed out: the account form with its inputs.
  {
    const context = await browser.newContext({ viewport, deviceScaleFactor: size.dpr });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.goto(BASE);
    await waitScene(page, 'account');
    await page.keyboard.type('Iltani');
    await page.keyboard.press('Tab');
    await page.keyboard.type('correct horse');
    console.log(`  inputs: ${await checkInputs(page)}`);
    await shot(page, `${size.name}-account`);
    await context.close();
  }
  // Signed in: the start screen, a fight, the inventory.
  const context = await browser.newContext({ viewport, deviceScaleFactor: size.dpr, storageState: account.state });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  await waitScene(page, 'start');
  await shot(page, `${size.name}-start`);
  const fits = await page.evaluate(() => {
    const c = window.__iot.game.canvas;
    return { canvas: [c.width, c.height] };
  });
  await fight(page);
  const info = await page.evaluate(() => window.__iot.scene()?.fits());
  console.log(`  canvas ${fits.canvas.join('×')}: zW ${info.world.zW}, view ${info.world.w}×${info.world.h}; zU ${info.ui.zU}`);
  await shot(page, `${size.name}-fight`);
  await page.evaluate(() => {
    const game = window.__iot.game;
    game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
    game.scene.start('start');
  });
  await waitScene(page, 'start');
  await clickButton(page, 'start', 'INVENTORY');
  await waitScene(page, 'inventory');
  await shot(page, `${size.name}-inventory`);
  await context.close();
}

if (m1) {
  // The same fight at 1920 × 912 on another client (main before G1.5), for comparison.
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  await page.goto(m1.base);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  await fight(page);
  await shot(page, m1.name);
  await context.close();
} else {
  const account = await setUpAccount();
  for (const size of SIZES) if (!only || size.name.startsWith(only)) await sizeShots(size, account);
}
await browser.close();
