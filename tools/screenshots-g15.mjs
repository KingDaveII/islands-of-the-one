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
 * `--run` (G1.5c, no account needed) runs the Kindled east and south at
 * moveSpeed 100 and shoots a strip of one run cycle per facing (`run`, 8
 * frames since ART drew it in #46), one 4× crop per frame, as
 * `run-<facing>-strip.png`. The cycle plays by distance, so frame k shows
 * after k × 12 world px (`anim.runCyclePx` 96 over 8 frames).
 *
 * `--rooms` (G1.5e, G1.5g; no account needed) shoots each of the five M1 rooms
 * at 1920 × 912 from the shipped sheets (tiles-cave, prop-chest, the Husks):
 * as it loads (doors closed, the chest shut), plus the room texture itself at
 * 1× (the static pieces, the whole room) as `room-<name>-texture.png`; then
 * it lets the autopilot fight and freezes the sim for a shot of the fight
 * (`room-<name>-fight.png`: a Husk hurt, the HUD moving), of the Hookblade's
 * charge (`-charge.png`, the spark at the tip; the bot charges only to open a
 * shelled Nutshell, so it may not come: `--poses` has the full charge in every
 * facing), of the Haul with the hook out (`-haul.png`) and, playing on at 4×
 * into the run's third room where the Nutshells come, of a Nutshell next to
 * the Kindled (`-nutshell.png`), each when the bot gets there within its
 * budget. For
 * the Shell Gallery and the Narrow Hollow it then lets the bot clear the room
 * and shoots the door open, with a strip of the door's frames at 4×; for the
 * Shell Gallery it also waits for the bot to open the chest and takes a strip
 * of the chest's frames at 4× (`chest-shell-gallery-strip.png`: closed with
 * the glint, opening, open) and the page with it open. Default folder
 * `docs/screenshots/g15g` (G1.5e's shots from the test fixture are in g15e).
 *
 * `--poses` (G1.5b, no account needed) poses the Kindled at 1920 × 912 in
 * each of the 8 facings and shoots the page plus a 4× crop around the
 * player: the `heavy_charge` last frame at full charge (the charge spark),
 * the `haul_throw` last frame while the hook flies, 32 sim px out (the chain
 * leaving the hand; G1.5d puts both on the frame's points), and
 * a light wind-up (`light_1` frame 0, the startup) facing E and S. With
 * `--only <facing>`, the shots of that facing alone.
 *
 * `--sort` (G1.5h, no account needed) opens the Shell Gallery, clears it and
 * stands the Kindled at the chest, its feet 1 sim px in front of the chest's
 * base and then 1 px behind, for the draw order by the ground line: the page
 * and a 4× crop each (`sort-kindled-front`, `sort-kindled-behind`).
 *
 * `--backpedal` (G1.5h, no account needed) runs the Kindled west while it
 * faces east, at moveSpeed 100, and shoots a strip of one run cycle as it
 * backpedals (`backpedal-E-moving-W-strip.png`): the run's frames in reverse,
 * 7 down to 0, one 4× crop per frame. Default folder `docs/screenshots/g15h`
 * for both.
 *
 * `--room-changes` (G1.5i, no account needed) is a check that fails loudly:
 * a run through the Narrow Hollow (10 × 40 cells) and the Shell Gallery
 * (19 × 32), so each room change is into a taller or a wider room, at
 * 1920 × 912. After each change (the room cleared and the Kindled stood in
 * the doorway) it reads the room texture's size and its GPU target's, and
 * compares the texture (`roomImage()`) with the pipeline's drawing of that
 * template cut from `art/review/tiles-cave/rooms.png`, pixel for pixel. It
 * prints a line per room and exits non-zero if a size is off, a pixel
 * differs or the renderer holds more GPU textures after the last room than
 * after the first (the old texture must be freed). Shots: the page in each
 * room (`room-change-<n>-<name>.png`) and the texture (`-texture.png`).
 * Default folder `docs/screenshots/g15i`.
 *
 * `--build-label` (G1.5i; makes a throwaway account through the API) shoots
 * the account screen and the start screen at 1920 × 912 with the build label
 * bottom right (`build-label-account.png`, `build-label-start.png`) and
 * prints what `window.__iot.build` says. Default folder `docs/screenshots/g15i`.
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-g15.mjs [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --room-changes [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --build-label [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --poses [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --run [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --rooms [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --sort [outDir] [baseUrl]
 *   node tools/screenshots-g15.mjs --backpedal [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const poses = (() => {
  const i = args.indexOf('--poses');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const runStrip = (() => {
  const i = args.indexOf('--run');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const roomsMode = (() => {
  const i = args.indexOf('--rooms');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const sortMode = (() => {
  const i = args.indexOf('--sort');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const backpedalMode = (() => {
  const i = args.indexOf('--backpedal');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const roomChangesMode = (() => {
  const i = args.indexOf('--room-changes');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const buildLabelMode = (() => {
  const i = args.indexOf('--build-label');
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
})();
const OUT = resolve(
  args[0] ??
    join(
      ROOT,
      roomsMode
        ? 'docs/screenshots/g15g'
        : sortMode || backpedalMode
          ? 'docs/screenshots/g15h'
          : roomChangesMode || buildLabelMode
            ? 'docs/screenshots/g15i'
            : 'docs/screenshots/g15',
    ),
);
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

/** The sheet's facings, in sheet order; a facing's aim is its sim angle (1/4096 turn, 0 = east, y down). */
const FACINGS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
const aimOf = (facing) => ((2 - FACINGS.indexOf(facing) + 8) % 8) * 512;
/** Packed sim input (packages/sim/src/input.ts): the aim in bits 0-11, buttons from bit 23. */
const BUTTON = { Light: 1, Heavy: 2, Ability1: 8 };
const packed = (aim, buttons) => ((aim & 0xfff) | (buttons << 23)) >>> 0;

/** The page's pixels around the player (`w` × `h` world px), each device px drawn 4 × 4. */
async function playerCrop(page, name, w = 72, h = 64) {
  writeFileSync(join(OUT, `${name}.png`), await playerCropPng(page, w, h));
  console.log(`  ${name}.png`);
}

/** `playerCrop`'s image as a PNG buffer. */
async function playerCropPng(page, w = 72, h = 64) {
  const png = await page.screenshot();
  const box = await page.evaluate(
    ({ w, h }) => {
      const scene = window.__iot.scene();
      const s = scene.session.state;
      const { zU } = scene.fits().ui;
      const { zW } = scene.fits().world;
      const c = scene.toUi(s.player.x / 256, s.player.y / 256);
      return { x: Math.round(c.x * zU - (w / 2) * zW), y: Math.round(c.y * zU - (h / 2 + 8) * zW), w: w * zW, h: h * zW };
    },
    { w, h },
  );
  const data = await page.evaluate(
    async ({ b64, box }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = box.w * 4;
      canvas.height = box.h * 4;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { b64: png.toString('base64'), box },
  );
  return Buffer.from(data, 'base64');
}

/**
 * Start a fresh run, play `input(state)` each tick until `until(state, pose)`
 * holds in the page, then freeze the sim (speed 0) for the shots.
 */
async function posed(page, seed, input, until) {
  await page.evaluate((seed) => window.__iot.startRun(seed), seed);
  await waitScene(page, 'game');
  await page.evaluate((src) => {
    const TILE = 16;
    const scene = window.__iot.scene();
    // Nothing in the way: the first wave held off, the player on the floor tile farthest from any wall or pillar.
    const s = scene.session.state;
    s.husks.length = 0;
    const { tiles, cols, rows } = s.room;
    const solid = (c, r) => r < 0 || r >= rows || c < 0 || c >= cols || '#oD'.includes(tiles[r][c]);
    let best = { c: 0, r: 0, d: -1 };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (solid(c, r)) continue;
        let d = 1;
        while (d < 16 && ![...Array(2 * d + 1).keys()].some((i) => solid(c - d + i, r - d) || solid(c - d + i, r + d) || solid(c - d, r - d + i) || solid(c + d, r - d + i))) d++;
        if (d > best.d) best = { c, r, d };
      }
    }
    s.player.x = (best.c * TILE + TILE / 2) * 256;
    s.player.y = (best.r * TILE + TILE / 2) * 256;
    window.__iot.setSpeed(0.5);
    window.__iot.setInputSource(new Function('s', `return (${src})(s);`));
  }, input);
  await page.waitForFunction(
    (src) => {
      const scene = window.__iot.scene();
      if (!scene) return false;
      scene.session.state.husks.length = 0;
      const done = new Function('s', 'pose', `return (${src})(s, pose);`)(scene.session.state, window.__iot.pose());
      // Frozen in the frame the pose shows up, before the next tick runs.
      if (done) window.__iot.setSpeed(0);
      return done;
    },
    until,
    { polling: 'raf', timeout: 60000 },
  );
  const at = await page.evaluate(() => {
    const p = window.__iot.scene().session.state.player;
    const pose = window.__iot.pose();
    return `${pose?.anim}#${pose?.frame} ${p.action} t${p.t}${p.hook ? ' hook' : ''}`;
  });
  console.log(`  posed: ${at}`);
  await sleep(250);
}

/** Sim px the hook has flown when the Haul shot is taken (G1.5d: two links of chain out of the hand). */
const HAUL_SHOT_REACH = 32;

async function poseShots() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  for (const facing of FACINGS) {
    if (only && only !== facing) continue;
    const aim = aimOf(facing);
    // The heavy held to full charge: the charge spark at spark_2.
    await posed(
      page,
      11,
      `() => ${packed(aim, BUTTON.Heavy)}`,
      `(s, pose) => pose?.anim === 'heavy_charge_${facing}' && pose.frame === 2 &&
        s.player.charge >= window.__iot.scene().session.run.params.weapon.heavy.chargeMax`,
    );
    await shot(page, `charge-${facing}`);
    await playerCrop(page, `charge-${facing}-4x`);
    // The Haul thrown into open floor: the throw's last frame while the hook flies.
    await posed(
      page,
      12,
      `(s) => (s.player.action === 'idle' && !s.player.hook ? ${packed(aim, BUTTON.Ability1)} : ${packed(aim, 0)})`,
      // G1.5d: far enough out that the chain shows a few links leaving the hand.
      `(s, pose) => pose?.anim === 'haul_throw_${facing}' && pose.frame === 1 && Boolean(s.player.hook) &&
        Math.hypot(s.player.hook.x - s.player.x, s.player.hook.y - s.player.y) / 256 >= ${HAUL_SHOT_REACH}`,
    );
    await shot(page, `haul-${facing}`);
    await playerCrop(page, `haul-${facing}-4x`);
  }
  for (const facing of ['E', 'S']) {
    if (only && only !== facing) continue;
    const aim = aimOf(facing);
    // One light press: the first strike's wind-up (light_1 frame 0, the startup).
    await posed(
      page,
      13,
      `(s) => (s.player.action === 'idle' && s.tick < 30 ? ${packed(aim, BUTTON.Light)} : ${packed(aim, 0)})`,
      `(s, pose) => pose?.anim === 'light_1_${facing}' && pose.frame === 0 &&
        s.player.action === 'light' && s.player.t >= 2`,
    );
    await shot(page, `windup-${facing}`);
    await playerCrop(page, `windup-${facing}-4x`);
  }
  await context.close();
}

/**
 * G1.5c: one run cycle per facing as a strip of 4× crops, each frame frozen
 * the moment it shows. The player runs at full stick from the open tile at
 * quarter speed, so every frame is on screen for several render frames.
 */
async function runShots() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  // Facing and move direction (1/256 turn: 0 east, 64 south), and the opposite way to start from.
  for (const [facing, moveDir] of [
    ['E', 0],
    ['S', 64],
  ]) {
    if (only && only !== facing) continue;
    const aim = aimOf(facing);
    const run = (((aim & 0xfff) | (moveDir << 12) | (7 << 20)) >>> 0).toString();
    // Up to speed first: the strip starts on the cycle's first frame after the body has been running.
    await posed(page, 21, `() => ${run}`, `(s, pose) => pose?.anim === 'run_${facing}' && pose.frame === 7`);
    const crops = [];
    for (let k = 0; k < 8; k++) {
      await page.evaluate(() => window.__iot.setSpeed(0.25));
      await page.waitForFunction(
        ({ facing, k }) => {
          const scene = window.__iot.scene();
          scene.session.state.husks.length = 0;
          const pose = window.__iot.pose();
          const done = pose?.anim === `run_${facing}` && pose.frame === k;
          if (done) window.__iot.setSpeed(0);
          return done;
        },
        { facing, k },
        { polling: 'raf', timeout: 30000 },
      );
      await sleep(150);
      const p = await page.evaluate(() => {
        const s = window.__iot.scene().session.state.player;
        return { x: s.x / 256, y: s.y / 256, vx: s.vx, vy: s.vy };
      });
      console.log(`  ${facing} frame ${k}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) sim px, v (${p.vx}, ${p.vy})`);
      crops.push((await playerCropPng(page, 56, 64)).toString('base64'));
    }
    const strip = await page.evaluate(async (crops) => {
      const imgs = await Promise.all(
        crops.map(async (b64) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          return img;
        }),
      );
      const gap = 8;
      const canvas = document.createElement('canvas');
      canvas.width = imgs.reduce((w, img) => w + img.width, 0) + gap * (imgs.length - 1);
      canvas.height = imgs[0].height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      let x = 0;
      for (const img of imgs) {
        ctx.drawImage(img, x, 0);
        x += img.width + gap;
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, crops);
    writeFileSync(join(OUT, `run-${facing}-strip.png`), Buffer.from(strip, 'base64'));
    console.log(`  run-${facing}-strip.png`);
  }
  await context.close();
}

/**
 * G1.5h: the Kindled stood at the Shell Gallery's chest with the sim frozen,
 * its feet (`y + PLAYER_FEET`, 5 sim px below the centre) 1 sim px in front
 * of the chest's base, then 1 px behind, 8 sim px to the chest's right so the
 * body overlaps it: the draw order by the ground line, the page and a 4× crop
 * around the player each time.
 */
async function sortShots() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  await openRoom(page, 'Shell Gallery', 5);
  for (const [name, feetOffset] of [
    ['front', 1],
    ['behind', -1],
  ]) {
    const at = await page.evaluate((feetOffset) => {
      const PLAYER_FEET = 5;
      const s = window.__iot.scene().session.state;
      s.husks.length = 0;
      const ch = s.chests[0];
      if (!ch) throw new Error('Shell Gallery has no chest');
      // Facing south, standing still, the feet `feetOffset` sim px from the chest's base line.
      s.player.aim = 1024;
      s.player.vx = 0;
      s.player.vy = 0;
      s.player.x = ch.x + 8 * 256;
      s.player.y = ch.y + (feetOffset - PLAYER_FEET) * 256;
      return { chest: { x: ch.x / 256, y: ch.y / 256 }, feet: (s.player.y + PLAYER_FEET * 256) / 256 };
    }, feetOffset);
    await sleep(400);
    console.log(`  ${name}: chest base y ${at.chest.y}, the Kindled's feet y ${at.feet} (sim px)`);
    await shot(page, `sort-kindled-${name}`);
    await playerCrop(page, `sort-kindled-${name}-4x`, 96, 80);
  }
  await context.close();
}

/** A strip of 4× player crops (PNG base64 each) side by side on white, as a PNG buffer. */
async function stripOfCrops(page, crops) {
  const strip = await page.evaluate(async (crops) => {
    const imgs = await Promise.all(
      crops.map(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        return img;
      }),
    );
    const gap = 8;
    const canvas = document.createElement('canvas');
    canvas.width = imgs.reduce((w, img) => w + img.width, 0) + gap * (imgs.length - 1);
    canvas.height = imgs[0].height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let x = 0;
    for (const img of imgs) {
      ctx.drawImage(img, x, 0);
      x += img.width + gap;
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, crops);
  return Buffer.from(strip, 'base64');
}

/**
 * G1.5h: one backpedalling run cycle as a strip of 4× crops, each frame
 * frozen the moment it shows. The Kindled faces east (the aim) and runs west
 * at full stick from the open tile, at quarter speed: 180° between movement
 * and facing, so the run plays in reverse, frame 7 down to 0.
 */
async function backpedalShots() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  const facing = 'E';
  const moveDir = 128; // west, 1/256 turn
  const aim = aimOf(facing);
  const run = (((aim & 0xfff) | (moveDir << 12) | (7 << 20)) >>> 0).toString();
  // Up to speed first: the strip starts once the reversed cycle has shown its last frame (frame 0).
  await posed(page, 21, `() => ${run}`, `(s, pose) => pose?.anim === 'run_${facing}' && pose.frame === 0 && s.player.vx < 0`);
  const crops = [];
  for (const k of [7, 6, 5, 4, 3, 2, 1, 0]) {
    await page.evaluate(() => window.__iot.setSpeed(0.25));
    await page.waitForFunction(
      ({ facing, k }) => {
        const scene = window.__iot.scene();
        scene.session.state.husks.length = 0;
        const pose = window.__iot.pose();
        const done = pose?.anim === `run_${facing}` && pose.frame === k;
        if (done) window.__iot.setSpeed(0);
        return done;
      },
      { facing, k },
      { polling: 'raf', timeout: 30000 },
    );
    await sleep(150);
    const p = await page.evaluate(() => {
      const s = window.__iot.scene().session.state.player;
      return { x: s.x / 256, y: s.y / 256, vx: s.vx, vy: s.vy };
    });
    console.log(`  ${facing} facing, moving W, frame ${k}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) sim px, v (${p.vx}, ${p.vy})`);
    crops.push((await playerCropPng(page, 56, 64)).toString('base64'));
  }
  writeFileSync(join(OUT, `backpedal-${facing}-moving-W-strip.png`), await stripOfCrops(page, crops));
  console.log(`  backpedal-${facing}-moving-W-strip.png`);
  await context.close();
}

/** The five M1 rooms, by their names in rooms.json. */
const ROOMS = ['Shell Gallery', 'Crossing', 'Narrow Hollow', 'Core Ring', 'Spill'];
const slug = (name) => name.toLowerCase().replaceAll(' ', '-');

/** Starts a run in one room and freezes the sim once the room is drawn. */
async function openRoom(page, name, seed = 5) {
  await page.evaluate(({ seed, name }) => window.__iot.startRun(seed, 'hookblade', [name]), { seed, name });
  await waitScene(page, 'game');
  await page.waitForFunction(() => Boolean(window.__iot.scene()?.session), null, { timeout: 10000 });
  await page.evaluate(() => window.__iot.setSpeed(0));
}

/**
 * Lets the sim run (at `speed`) until `until(state)` holds in the page, then
 * freezes it (speed 0) for a shot. False when `timeoutMs` passes first.
 */
async function freezeWhen(page, until, timeoutMs, speed = 1) {
  await page.evaluate((speed) => window.__iot.setSpeed(speed), speed);
  try {
    const result = await page.waitForFunction(
      (src) => {
        const scene = window.__iot.scene();
        // The run ended (the results screen): nothing more to wait for.
        if (!scene) return 'over';
        const done = new Function('s', `return (${src})(s);`)(scene.session.state);
        if (done) window.__iot.setSpeed(0);
        return done;
      },
      until,
      { polling: 'raf', timeout: timeoutMs },
    );
    return (await result.jsonValue()) === true;
  } catch {
    await page.evaluate(() => window.__iot.scene() && window.__iot.setSpeed(0));
    return false;
  }
}

/** A Husk is hurt and the player is solid (no i-frame flicker): the fight is on. */
const FIGHT_ON = `(s) => {
  const hostiles = s.husks.filter((h) => h.action !== 'spawn' && h.core > 0);
  const hurt = s.husks.some((h) => h.shell.some((v) => v <= 0) || h.action === 'flinch' || h.hitstop > 0);
  return hostiles.length >= 1 && hurt && s.player.iframes === 0 && s.player.hurtInvuln === 0;
}`;
/** A Nutshell awake and within ten tiles of the player, so the shot has it next to the Kindled. */
const NUTSHELL_NEAR = `(s) => s.husks.some((h) => h.kind === 'nutshell' && h.action !== 'spawn' && h.core > 0 &&
  Math.hypot(h.x - s.player.x, h.y - s.player.y) / 256 < 160) && s.player.iframes === 0 && s.player.hurtInvuln === 0`;
/** The heavy held past its first charge stage (the spark at the tip), a Husk awake to aim at. */
const CHARGE_FULL = `(s) => s.player.action === 'charge' &&
  s.player.charge >= window.__iot.scene().session.run.params.weapon.heavy.chargeMin && s.husks.some((h) => h.core > 0)`;
/** The Haul thrown: the hook out and some way from the hand. */
const HAUL_OUT = `(s) => Boolean(s.player.hook) && s.player.action === 'ability' &&
  Math.hypot(s.player.hook.x - s.player.x, s.player.hook.y - s.player.y) / 256 >= 24`;

/** A strip of `framesSeen` entries, each image cut at its own box, `w` × `h` world px each at 4×. */
async function stripOf(page, entries, w, h) {
  return page.evaluate(
    async ({ entries, w, h }) => {
      const imgs = await Promise.all(
        entries.map(async (e) => {
          const img = new Image();
          img.src = e.url;
          await img.decode();
          return img;
        }),
      );
      const k = 4;
      const gap = 8;
      const canvas = document.createElement('canvas');
      canvas.width = imgs.length * (w * k + gap) - gap;
      canvas.height = h * k;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      imgs.forEach((img, i) => {
        const { at } = entries[i];
        ctx.drawImage(img, at.x, at.y, at.w, at.h, i * (w * k + gap), 0, w * k, h * k);
      });
      return canvas.toDataURL('image/png').split(',')[1];
    },
    { entries, w, h },
  );
}

/**
 * The page's pixels at each new value of `frames()` over `ms` of the client
 * clock, through Phaser's renderer snapshot: `{ frame, url, at }` in the order
 * first seen, `at` the canvas-px box of `crop` (`w` × `h` world px around the
 * sim point, the point `ox`, `oy` into the box) as the camera stood at that
 * moment, so a strip can cut each image where the thing was.
 */
async function framesSeen(page, framesSrc, ms, crop) {
  return page.evaluate(
    async ({ framesSrc, ms, crop }) => {
      const read = new Function(`return (${framesSrc})();`);
      const scene = window.__iot.scene();
      const snap = () =>
        new Promise((resolve) => {
          window.__iot.game.renderer.snapshot((img) => resolve(img instanceof HTMLImageElement ? img.src : null));
        });
      const boxNow = () => {
        const { zU } = scene.fits().ui;
        const { zW } = scene.fits().world;
        const c = scene.toUi(crop.sim.x, crop.sim.y);
        return { x: Math.round(c.x * zU - crop.ox * zW), y: Math.round(c.y * zU - crop.oy * zW), w: crop.w * zW, h: crop.h * zW };
      };
      const seen = [];
      const until = performance.now() + ms;
      while (performance.now() < until) {
        const [frame] = read();
        if (frame && !seen.some((e) => e.frame === frame)) {
          const at = boxNow();
          const entry = { frame, url: null, at };
          seen.push(entry);
          entry.url = await snap();
        }
        await new Promise((r) => requestAnimationFrame(r));
      }
      return seen;
    },
    { framesSrc, ms, crop },
  );
}

/**
 * G1.5g: the five rooms from the shipped sheets, as they load and in a fight
 * (with the charge and the Haul where the bot gets to them), two door
 * openings and the chest's three states.
 */
async function roomShots() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  for (const name of ROOMS) {
    if (only && only !== slug(name)) continue;
    await openRoom(page, name);
    await sleep(600);
    await shot(page, `room-${slug(name)}`);
    const url = await page.evaluate(() => window.__iot.roomImage());
    if (!url) throw new Error(`${name}: no tile room`);
    writeFileSync(join(OUT, `room-${slug(name)}-texture.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`  room-${slug(name)}-texture.png`);
    // The fight: the bot plays; the sim freezes the frame a Husk is hurt with the player solid.
    await page.evaluate(() => window.__iot.setAutopilot({}));
    if (await freezeWhen(page, FIGHT_ON, 40000)) await shot(page, `room-${slug(name)}-fight`);
    else console.log(`  ${name}: no fight within the budget`);
    for (const [what, until, budget, speed] of [
      ['charge', CHARGE_FULL, 60000, 1],
      ['haul', HAUL_OUT, 60000, 1],
      // Nutshells come with the third room of a run (tuning.json `run.rooms`), so this one plays on at 4×.
      ['nutshell', NUTSHELL_NEAR, 120000, 4],
    ]) {
      if (await freezeWhen(page, until, budget, speed)) await shot(page, `room-${slug(name)}-${what}`);
      else console.log(`  ${name}: no ${what} within the budget`);
    }
    const state = await page.evaluate(() => {
      const s = window.__iot.scene()?.session.state;
      return s ? `${s.husks.map((h) => h.kind).join(', ') || 'no Husks'}; player ${s.player.action}` : 'the run is over';
    });
    console.log(`  ${name}: ${state}`);
  }
  for (const name of ['Shell Gallery', 'Narrow Hollow']) {
    if (only && only !== slug(name)) continue;
    // Cleared by the autopilot; the sim freezes the tick the door opens, the client clock plays it open.
    await openRoom(page, name);
    await page.evaluate(() => {
      window.__iot.setAutopilot({});
      window.__iot.setSpeed(4);
    });
    // Each door frame the client shows while it opens, its first sighting, as a whole-room image.
    const seen = await page.evaluate(async () => {
      const frames = new Map();
      await new Promise((resolve) => {
        const tick = () => {
          const s = window.__iot.scene();
          if (s?.session.state.room.doorOpen) {
            window.__iot.setSpeed(0);
            resolve();
          } else requestAnimationFrame(tick);
        };
        tick();
      });
      const until = performance.now() + 900;
      while (performance.now() < until) {
        const [frame] = window.__iot.doorFrames();
        if (frame && !frames.has(frame)) frames.set(frame, await window.__iot.roomImage());
        await new Promise((r) => requestAnimationFrame(r));
      }
      return [...frames];
    });
    console.log(`  ${name} door frames seen: ${seen.map(([f]) => f).join(', ')}`);
    await shot(page, `room-${slug(name)}-open`);
    const last = seen[seen.length - 1];
    if (last) writeFileSync(join(OUT, `room-${slug(name)}-open-texture.png`), Buffer.from(last[1].split(',')[1], 'base64'));
    // A strip of the door's frames at 4×, cropped from those images.
    const box = await page.evaluate(() => {
      const t = window.__iot.scene().session.state.room.tiles;
      const cells = [];
      t.forEach((row, r) => [...row].forEach((ch, c) => ch === 'D' && cells.push([c, r])));
      const xs = cells.map(([c]) => c);
      const ys = cells.map(([, r]) => r);
      return { x: Math.min(...xs) * 32, y: Math.min(...ys) * 32, w: (Math.max(...xs) - Math.min(...xs) + 1) * 32, h: (Math.max(...ys) - Math.min(...ys) + 1) * 32 };
    });
    const strip = await page.evaluate(
      async ({ urls, box }) => {
        const imgs = await Promise.all(
          urls.map(async (u) => {
            const img = new Image();
            img.src = u;
            await img.decode();
            return img;
          }),
        );
        const k = 4;
        const gap = 8;
        const canvas = document.createElement('canvas');
        canvas.width = imgs.length * (box.w * k + gap) - gap;
        canvas.height = box.h * k;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        imgs.forEach((img, i) => ctx.drawImage(img, box.x, box.y, box.w, box.h, i * (box.w * k + gap), 0, box.w * k, box.h * k));
        return canvas.toDataURL('image/png').split(',')[1];
      },
      { urls: seen.map(([, u]) => u), box },
    );
    writeFileSync(join(OUT, `door-${slug(name)}-strip.png`), Buffer.from(strip, 'base64'));
    console.log(`  door-${slug(name)}-strip.png`);
  }
  if (!only || only === 'shell-gallery') {
    // The chest: closed (both glint frames) as the room loads, then the bot opens it between waves.
    await openRoom(page, 'Shell Gallery');
    const chest = await page.evaluate(() => {
      const c = window.__iot.scene().session.state.chests[0];
      return c ? { x: c.x / 256, y: c.y / 256 } : null;
    });
    if (!chest) throw new Error('Shell Gallery: no chest');
    // The chest's cell is 64×64 with its origin at (32, 54): the crop around the sim point.
    const CHEST_CROP = { sim: chest, w: 64, h: 64, ox: 32, oy: 54 };
    const closed = await framesSeen(page, '() => window.__iot.chestFrames()', 1200, CHEST_CROP);
    console.log(`  chest closed frames seen: ${closed.map((e) => e.frame).join(', ')}`);
    // The bot only takes a chest between waves and rarely gets there: stand the Kindled four tiles east of
    // it with the room emptied and walk it in; the sim freezes the tick the chest opens, the client clock
    // plays the lid.
    await page.evaluate(() => {
      const scene = window.__iot.scene();
      const s = scene.session.state;
      const c = s.chests[0];
      s.player.x = c.x + 64 * 256;
      s.player.y = c.y;
      window.__iot.setInputSource((st) => {
        st.husks.length = 0;
        const ch = st.chests[0];
        if (!ch) return 0;
        const turn = Math.atan2(ch.y - st.player.y, ch.x - st.player.x) / (Math.PI * 2);
        const aim = Math.round(turn * 4096) & 0xfff;
        const dir = Math.round(turn * 256) & 0xff;
        return (aim | (dir << 12) | (7 << 20)) >>> 0;
      });
      window.__iot.setSpeed(1);
    });
    const opened = await page
      .waitForFunction(
        () => {
          const s = window.__iot.scene()?.session.state;
          const done = Boolean(s?.chests[0]?.opened);
          if (done) window.__iot.setSpeed(0);
          return done;
        },
        null,
        { polling: 'raf', timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!opened) throw new Error('Shell Gallery: the Kindled never reached the chest');
    // Step the Kindled clear of the chest (the sim is frozen; the render reads the state) so the lid shows whole.
    await page.evaluate(() => {
      window.__iot.setInputSource(null);
      const s = window.__iot.scene().session.state;
      s.player.x = s.chests[0].x + 56 * 256;
    });
    const opening = await framesSeen(page, '() => window.__iot.chestFrames()', 900, CHEST_CROP);
    console.log(`  chest frames seen: ${opening.map((e) => e.frame).join(', ')}`);
    await shot(page, 'room-shell-gallery-chest-open');
    const frames = [...closed, ...opening].filter((e) => e.url);
    const strip = await stripOf(page, frames, CHEST_CROP.w, CHEST_CROP.h);
    writeFileSync(join(OUT, 'chest-shell-gallery-strip.png'), Buffer.from(strip, 'base64'));
    console.log(`  chest-shell-gallery-strip.png (${frames.map((e) => e.frame).join(', ')})`);
  }
  await context.close();
}

/**
 * Stand the Kindled in the doorway of a cleared room: the room's phase set
 * to cleared with its door open, as the sim leaves it after the last wave,
 * and the player on a door cell; the next tick enters room `index`.
 */
async function enterNextRoom(page, index) {
  await page.evaluate(() => {
    const s = window.__iot.scene().session.state;
    const door = [];
    s.room.tiles.forEach((row, r) => [...row].forEach((ch, c) => ch === 'D' && door.push([c, r])));
    if (!door.length) throw new Error(`no door in room ${s.roomIndex + 1}`);
    const [c, r] = door[0];
    s.husks.length = 0;
    s.room.phase = 'cleared';
    s.room.doorOpen = true;
    s.player.x = (c * 16 + 8) * 256;
    s.player.y = (r * 16 + 8) * 256;
    window.__iot.setSpeed(1);
  });
  await page.waitForFunction(
    (index) => {
      const s = window.__iot.scene()?.session.state;
      const done = s?.roomIndex === index;
      if (done) window.__iot.setSpeed(0);
      return done;
    },
    index,
    { polling: 'raf', timeout: 10000 },
  );
}

/**
 * G1.5i: the room texture after each room change. Three rooms from two
 * templates of different shapes, so the texture has to grow in each
 * direction; after each change its size, its GPU target's size and its
 * pixels against the pipeline's rooms.png. Throws on any difference.
 */
async function roomChangeShots() {
  const review = join(ROOT, 'art/review/tiles-cave');
  const report = JSON.parse(readFileSync(join(review, 'report.json'), 'utf8'));
  const roomsPng = `data:image/png;base64,${readFileSync(join(review, 'rooms.png')).toString('base64')}`;
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  for (let i = 0; i < 100 && !(await page.evaluate(() => Boolean(window.__iot))); i++) await sleep(100);
  await page.evaluate(() => window.__iot.startRun(5, 'hookblade', ['Narrow Hollow', 'Shell Gallery']));
  await waitScene(page, 'game');
  await page.waitForFunction(() => Boolean(window.__iot.scene()?.session), null, { timeout: 10000 });
  await page.evaluate(() => window.__iot.setSpeed(0));
  const order = await page.evaluate(() => {
    const { run, state } = window.__iot.scene().session;
    return state.roomOrder.map((i) => run.templates[i].name);
  });
  console.log(`  rooms: ${order.join(' > ')}`);
  const rows = [];
  for (let i = 0; i < order.length; i++) {
    if (i > 0) await enterNextRoom(page, i);
    await sleep(400);
    const name = order[i];
    const room = report.rooms.find((r) => r.name === name);
    if (!room) throw new Error(`${name} is not in ${review}/report.json`);
    const expect = { w: room.cols * 32, h: room.rows * 32 };
    const got = await page.evaluate(
      async ({ roomsPng, at, expect }) => {
        const size = window.__iot.roomTextureSize();
        const url = await window.__iot.roomImage();
        const load = async (src) => {
          const img = new Image();
          img.src = src;
          await img.decode();
          return img;
        };
        const [tex, ref] = await Promise.all([load(url), load(roomsPng)]);
        // Both through a canvas: the texture's pixels (transparent past its edge) against the reference's cut.
        const pixels = (img, sx, sy) => {
          const canvas = document.createElement('canvas');
          canvas.width = expect.w;
          canvas.height = expect.h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, sx, sy, expect.w, expect.h, 0, 0, expect.w, expect.h);
          return ctx.getImageData(0, 0, expect.w, expect.h).data;
        };
        const a = pixels(tex, 0, 0);
        const b = pixels(ref, at[0], at[1]);
        let differ = 0;
        let first = null;
        for (let p = 0; p < a.length; p += 4) {
          if (a[p] === b[p] && a[p + 1] === b[p + 1] && a[p + 2] === b[p + 2] && a[p + 3] === b[p + 3]) continue;
          differ++;
          first ??= [(p / 4) % expect.w, Math.floor(p / 4 / expect.w)];
        }
        const wrappers = window.__iot.game.renderer.glTextureWrappers;
        return { size, image: { w: tex.width, h: tex.height }, differ, first, glTextures: wrappers ? wrappers.length : null, url };
      },
      { roomsPng, at: room.at, expect },
    );
    const tag = `room-change-${i + 1}-${slug(name)}`;
    writeFileSync(join(OUT, `${tag}-texture.png`), Buffer.from(got.url.split(',')[1], 'base64'));
    await shot(page, tag);
    const dim = (d) => (d ? `${d.w}x${d.h}` : 'none');
    const problems = [];
    if (!got.size || got.size.w !== expect.w || got.size.h !== expect.h) problems.push('texture size');
    if (got.size?.target && (got.size.target.w !== expect.w || got.size.target.h !== expect.h)) problems.push('GPU target size');
    if (got.image.w !== expect.w || got.image.h !== expect.h) problems.push('image size');
    if (got.differ > 0) problems.push(`${got.differ} px differ from rooms.png, first at (${got.first.join(', ')})`);
    rows.push({ name, problems, glTextures: got.glTextures });
    console.log(
      `  ${i + 1}. ${name}: expected ${dim(expect)}, texture ${dim(got.size)}, GPU target ${dim(got.size?.target)}, image ${dim(got.image)}, ` +
        `${got.differ} px differ, ${got.glTextures ?? '?'} GPU textures` +
        (problems.length ? `  <-- ${problems.join('; ')}` : ''),
    );
  }
  await context.close();
  const first = rows[0]?.glTextures;
  const last = rows[rows.length - 1]?.glTextures;
  if (first !== null && last !== null && last > first) rows[rows.length - 1].problems.push(`GPU textures grew from ${first} to ${last}: a room texture leaked`);
  const failed = rows.filter((r) => r.problems.length);
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  if (failed.length) throw new Error(`room changes failed: ${failed.map((r) => `${r.name}: ${r.problems.join('; ')}`).join(' | ')}`);
  console.log(`  ${rows.length} rooms, each texture its room's size and the pipeline's picture`);
}

/** G1.5i: the build label on the account screen and, signed in, on the start screen. */
async function buildLabelShots() {
  const context = await browser.newContext({ viewport: { width: 1920, height: 912 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(BASE);
  await waitScene(page, 'account');
  await sleep(600);
  console.log(`  build: ${JSON.stringify(await page.evaluate(() => window.__iot.build))}`);
  await shot(page, 'build-label-account');
  const username = `build${Date.now() % 100000}`;
  const status = await page.evaluate(async (username) => {
    const post = (url, body) =>
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const reg = await post('/api/register', { username, password: 'correct horse battery' });
    const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'ash' });
    return [reg.status, k.status];
  }, username);
  if (status.join() !== '201,201') throw new Error(`setup failed: ${status.join()}`);
  await page.reload();
  await waitScene(page, 'start');
  await sleep(600);
  await shot(page, 'build-label-start');
  await context.close();
}

if (buildLabelMode) {
  await buildLabelShots();
} else if (roomChangesMode) {
  await roomChangeShots();
} else if (roomsMode) {
  await roomShots();
} else if (sortMode) {
  await sortShots();
} else if (backpedalMode) {
  await backpedalShots();
} else if (runStrip) {
  await runShots();
} else if (poses) {
  await poseShots();
} else if (m1) {
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
