#!/usr/bin/env node
/**
 * Text screenshots for docs/screenshots/m1-task8b (text over the world: dark
 * words, shadowed coloured numbers, no chips): floaters (BREAK, CRACK, -12,
 * +1 RATION) over the floor and over a Husk, the room banner and the YOU
 * FELL banner, at zoom 3 (device px per game px) on a 150 % display. Runs
 * the built client in headless Chromium through the `window.__iot` playtest
 * hooks; the shots are captured in device pixels.
 *
 *   pnpm --filter @iot/client build && node tools/screenshots-task8b.mjs [outDir]
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/client/dist');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m1-task8b'));
const VIEW = { w: 480, h: 270 };
const ZOOM = 3;
const DPR = 1.5;

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

/** A Husk next to the player (dx, dy in game px), standing in its chase pose. */
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

/** Put the player on the floor tile with the most open floor around it (the camera snaps to it). */
const openSpot = () => {
  const scene = window.__iot.scene();
  const s = scene.session.run.state;
  const room = s.room;
  const wall = (c, r) =>
    c < 0 || r < 0 || c >= room.cols || r >= room.rows || '#oD'.includes(room.tiles[r][c]);
  let best = null;
  for (let r = 0; r < room.rows; r++)
    for (let c = 0; c < room.cols; c++) {
      if (wall(c, r)) continue;
      let radius = 0;
      while (radius < 6) {
        let clear = true;
        for (let dr = -radius - 1; dr <= radius + 1 && clear; dr++)
          for (let dc = -radius - 1; dc <= radius + 1; dc++)
            if (wall(c + dc, r + dr)) {
              clear = false;
              break;
            }
        if (!clear) break;
        radius++;
      }
      if (!best || radius > best.radius) best = { c, r, radius };
    }
  s.player.x = (best.c * 16 + 8) * 256;
  s.player.y = (best.r * 16 + 8) * 256;
  s.player.vx = 0;
  s.player.vy = 0;
  scene.lastRoom = -1; // the camera snaps to the new spot on the next frame
};

/** The four floaters around a point (dx, dy from the player, game px), held still. */
const floaters = ({ dx, dy, stacked = false }) => {
  const scene = window.__iot.scene();
  const s = scene.session.run.state;
  const cam = scene.cameras.main;
  const x = s.player.x / 256 + dx;
  const y = s.player.y / 256 + dy;
  if (stacked) {
    // On a body: the words across it, one under the other.
    scene.fx.float(x, y - 18, '-12', 1e9, 0xf07a3a);
    scene.fx.float(x, y - 4, 'BREAK', 1e9);
    scene.fx.float(x, y + 10, 'CRACK', 1e9);
    scene.fx.float(x, y + 26, '+1 RATION', 1e9, 0xf2b65a);
  } else {
    scene.fx.float(x - 26, y - 10, 'BREAK', 1e9);
    scene.fx.float(x + 26, y - 10, 'CRACK', 1e9);
    scene.fx.float(x, y - 26, '-12', 1e9, 0xf07a3a);
    scene.fx.float(x, y + 24, '+1 RATION', 1e9, 0xf2b65a);
  }
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
  // A window that fits exactly ZOOM device pixels per game pixel (CSS px = device px / DPR).
  const page = await browser.newPage({
    viewport: { width: Math.ceil((VIEW.w * ZOOM) / DPR), height: Math.ceil((VIEW.h * ZOOM) / DPR) },
    deviceScaleFactor: DPR,
  });
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('page error:', e.message);
  });
  const tag = `z${ZOOM}-dpr${DPR}`;
  const shot = async (name, clip) => {
    await page.screenshot({
      path: join(OUT, `${name}-${tag}.png`),
      scale: 'device',
      ...(clip ? { clip } : {}),
    });
    console.log(`${name}-${tag}.png`);
  };
  /** A clip around a point (game px) in CSS px (the screenshot is still in device px). */
  const clipAround = (c, w, h) => {
    const x = Math.max(0, Math.min(VIEW.w - w, Math.round(c.x - w / 2)));
    const y = Math.max(0, Math.min(VIEW.h - h, Math.round(c.y - h / 2)));
    const k = ZOOM / DPR;
    return { x: x * k, y: y * k, width: w * k, height: h * k };
  };
  const quiet = async (seed) => {
    await page.evaluate((s) => window.__iot.startRun(s), seed);
    await page.waitForFunction(() => window.__iot.scene() !== null && window.__iot.pose() !== null);
    await page.evaluate(openSpot);
    await page.evaluate(() => {
      window.__iot.scene().session.run.state.room.timer = -1000000;
      window.__iot.setSpeed(0);
    });
    // The banner state, to tell in the log whether the room banner is up.
    return page.evaluate(() => {
      const scene = window.__iot.scene();
      return {
        bannerLife: scene.bannerLife,
        banner: scene.banner.text,
        visible: scene.banner.visible,
      };
    });
  };

  await page.goto(url);
  await page.waitForFunction(() => typeof window.__iot !== 'undefined');
  const z = await page.evaluate(() => window.__iot.game.scale.zoom);
  if (Math.abs(z * DPR - ZOOM) > 1e-6) throw new Error(`game zoom ${z} is not ${ZOOM} device px`);

  // 1. The room banner, right after the run starts (the roomEnter event shows it for 1.4 s).
  console.log('banner after start:', JSON.stringify(await quiet(1)));
  await page.waitForTimeout(150);
  await shot('room-banner');

  // 2. Floaters over the floor, beside the player.
  await page.waitForTimeout(1600);
  const floor = await page.evaluate(floaters, { dx: 0, dy: 0 });
  await page.waitForTimeout(150);
  await shot('floaters-floor', clipAround(floor, 150, 90));

  // 3. Floaters over a Husk: a Nutshell beside the player, the words on it.
  await quiet(2);
  await page.waitForTimeout(1600);
  await page.evaluate(placeHusk, { kind: 'nutshell', dx: 40, dy: 0 });
  await page.waitForTimeout(100);
  const husk = await page.evaluate(floaters, { dx: 40, dy: 0, stacked: true });
  await page.waitForTimeout(150);
  await shot('floaters-husk', clipAround(husk, 150, 90));

  // 4. YOU FELL: the Kindled at 1 HP takes a Peeling's lunge; the banner shows for 1.9 s.
  await page.evaluate(() => window.__iot.startRun(3));
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
