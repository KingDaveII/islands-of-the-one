#!/usr/bin/env node
/**
 * Historical (M1/M2): this script assumes M1's 480 × 270 canvas at a CSS
 * zoom. Since G1.5 (the canvas at device resolution, a world and a UI camera)
 * it no longer runs as-is; its shots stay the record of their task.
 * tools/screenshots-g15.mjs is the current script.
 *
 * Text screenshots for docs/screenshots/m1-task8 (pixel text from bitmap
 * fonts): the start screen, the HUD, a BREAK floater with damage numbers
 * over the floor, the YOU FELL banner and the results screen, each at zoom
 * 3 and 4 and at the device scale factors of a 125 % and a 150 % display
 * (the zoom is whole device pixels per game pixel, zoom.ts). Runs the built
 * client in headless Chromium through the `window.__iot` playtest hooks;
 * the shots are captured in device pixels.
 *
 *   pnpm --filter @iot/client build && node tools/screenshots-task8.mjs [outDir]
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/client/dist');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m1-task8'));
const VIEW = { w: 480, h: 270 };
/** Device pixels per game pixel, and the display's device scale factor. */
const SETUPS = [
  { zoom: 3, dpr: 1 },
  { zoom: 4, dpr: 1 },
  { zoom: 3, dpr: 1.25 },
  { zoom: 4, dpr: 1.25 },
  { zoom: 3, dpr: 1.5 },
  { zoom: 4, dpr: 1.5 },
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

async function serve(dir) {
  const types = {
    html: 'text/html',
    js: 'text/javascript',
    css: 'text/css',
    png: 'image/png',
    json: 'application/json',
    woff2: 'font/woff2',
    map: 'application/json',
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let file = join(dir, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!existsSync(file)) file = join(dir, 'index.html');
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': types[file.split('.').pop()] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

// --- In-page scripts ---------------------------------------------------------

/** A Peeling next to the player, already winding up its lunge. */
const placeHusk = ({ kind, dx, dy, patch = {} }) => {
  const scene = window.__iot.scene();
  const s = scene.session.run.state;
  const hp = scene.session.run.params.husks[kind];
  const h = {
    id: s.nextId++,
    kind,
    x: s.player.x + dx * 256,
    y: s.player.y + dy * 256,
    vx: 0,
    vy: 0,
    shell: [...hp.shell],
    core: hp.core,
    action: 'chase',
    t: 0,
    attackDir: 2048,
    attackHit: false,
    cooldown: 100000,
    hitstop: 0,
    strafe: 1,
    pushX: 0,
    pushY: 0,
    pushT: 0,
    stagger: 0,
    held: null,
    sinceHit: 0,
    ...patch,
  };
  s.husks.push(h);
  return h.id;
};

/** Floaters over the floor around the player, held still: a shell BREAK and CRACK, a damage number, a pickup. */
const floaters = () => {
  const scene = window.__iot.scene();
  const s = scene.session.run.state;
  const cam = scene.cameras.main;
  const x = s.player.x / 256;
  const y = s.player.y / 256;
  scene.fx.float(x - 30, y - 12, 'BREAK', 0xf4efe6, 1e9);
  scene.fx.float(x + 30, y - 12, 'CRACK', 0xf4efe6, 1e9);
  scene.fx.float(x, y - 30, '-12', 0xf07a3a, 1e9);
  scene.fx.float(x + 4, y + 26, '+1 RATION', 0xf2b65a, 1e9);
  for (const f of scene.fx.floaters) f.vy = 0;
  return { x: x - cam.scrollX, y: y - cam.scrollY };
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(join(DIST, 'index.html')))
    throw new Error('build the client first: pnpm --filter @iot/client build');
  const { server, url } = await serve(DIST);
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors = [];
  for (const { zoom, dpr } of SETUPS) {
    const tag = `z${zoom}-dpr${dpr}`;
    // A window that fits exactly `zoom` device pixels per game pixel (CSS px = device px / dpr).
    const page = await browser.newPage({
      viewport: {
        width: Math.ceil((VIEW.w * zoom) / dpr),
        height: Math.ceil((VIEW.h * zoom) / dpr),
      },
      deviceScaleFactor: dpr,
    });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error('page error:', e.message);
    });
    const shot = async (name, clip) => {
      await page.screenshot({
        path: join(OUT, `${name}-${tag}.png`),
        scale: 'device',
        ...(clip ? { clip } : {}),
      });
      console.log(`${name}-${tag}.png`);
    };
    /** A clip around the player in CSS px (the screenshot is still in device px). */
    const clipAround = (c, w, h) => {
      const x = Math.max(0, Math.min(VIEW.w - w, Math.round(c.x - w / 2)));
      const y = Math.max(0, Math.min(VIEW.h - h, Math.round(c.y - h / 2)));
      const k = zoom / dpr;
      return { x: x * k, y: y * k, width: w * k, height: h * k };
    };

    await page.goto(url);
    await page.waitForFunction(() => typeof window.__iot !== 'undefined');
    const z = await page.evaluate(() => window.__iot.game.scale.zoom);
    if (Math.abs(z * dpr - zoom) > 1e-6)
      throw new Error(`${tag}: game zoom ${z} is not ${zoom} device px`);
    await page.waitForTimeout(400);
    await shot('start');

    // The HUD at the start of a quiet run.
    await page.evaluate(() => window.__iot.startRun(1));
    await page.waitForFunction(() => window.__iot.scene() !== null && window.__iot.pose() !== null);
    await page.evaluate(() => {
      window.__iot.scene().session.run.state.room.timer = -1000000;
      window.__iot.setSpeed(0);
    });
    await page.waitForTimeout(250);
    await shot('hud');

    // Floaters over the floor.
    const c = await page.evaluate(floaters);
    await page.waitForTimeout(150);
    await shot('floaters', clipAround(c, 150, 90));

    // YOU FELL: the Kindled at 1 HP takes a Peeling's lunge; the banner shows for 1.9 s, then the results screen.
    await page.evaluate(() => window.__iot.startRun(2));
    await page.waitForFunction(() => window.__iot.scene() !== null && window.__iot.pose() !== null);
    await page.evaluate(placeHusk, {
      kind: 'peeling',
      dx: 30,
      dy: 0,
      patch: { action: 'windup', t: 20, attackDir: 2048 },
    });
    await page.evaluate(() => {
      window.__iot.scene().session.run.state.player.hp = 1;
      window.__iot.setInputSource(() => 0);
      window.__iot.setSpeed(1);
    });
    await page.waitForFunction(
      () => window.__iot.scene()?.session.run.state.status === 'dead',
      null,
      { polling: 'raf', timeout: 15000 },
    );
    await page.evaluate(() => window.__iot.setSpeed(0));
    await page.waitForTimeout(500);
    await shot('you-fell');
    await page.waitForFunction(() => window.__iot.game.scene.isActive('results'), null, {
      timeout: 5000,
    });
    await page.waitForTimeout(300);
    await shot('results');
    await page.close();
  }
  await browser.close();
  server.close();
  if (errors.length) {
    console.error(`${errors.length} page error(s)`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
