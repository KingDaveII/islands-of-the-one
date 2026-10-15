#!/usr/bin/env node
/**
 * Historical (M1/M2): this script assumes M1's 480 × 270 canvas at a CSS
 * zoom. Since G1.5 (the canvas at device resolution, a world and a UI camera)
 * it no longer runs as-is; its shots stay the record of their task.
 * tools/screenshots-g15.mjs is the current script.
 *
 * Screenshots for docs/screenshots/m1-task6 (Playtest 2 polish): the pad
 * reticle and Haul guide (C), the start screen's text at zoom 3 and 4 and at
 * a fractional device pixel ratio (E), the HUD's safe margins with the
 * player in each corner of the largest room (F), and the hints following
 * the active device (D). Runs the built client in headless Chromium through
 * the `window.__iot` hooks; the gamepad is a fake `navigator.getGamepads`.
 *
 *   pnpm --filter @iot/client build && node tools/screenshots-task6.mjs [outDir] [sections]
 *
 * `sections` is any of C, D, E, F, W (default: all); W is the text drawn over the world and the
 * Haul guide at a wall.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/client/dist');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m1-task6'));
const SECTIONS = (process.argv[3] ?? 'CDEFW').toUpperCase();
const VIEW = { w: 480, h: 270 };
const ZOOM = 2;

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

/** A fake standard-mapping DualSense on navigator.getGamepads; `window.__pad` is edited by later calls. */
const installPad = () => {
  const pad = {
    id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    timestamp: 0,
  };
  window.__pad = pad;
  navigator.getGamepads = () => [pad];
};
/** Set the fake pad: `axes` (4) and the pressed button indexes. */
const setPad = ({ axes, pressed }) => {
  const pad = window.__pad;
  if (axes) pad.axes = axes;
  pad.buttons.forEach((b, i) => {
    const on = (pressed ?? []).includes(i);
    b.pressed = on;
    b.touched = on;
    b.value = on ? 1 : 0;
  });
};
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
const OPEN_SPOT = `
  const s = window.__iot.scene().session.run.state;
  const room = s.room;
  const wall = (c, r) => c < 0 || r < 0 || c >= room.cols || r >= room.rows || '#oD'.includes(room.tiles[r][c]);
  let best = null;
  for (let r = 0; r < room.rows; r++) for (let c = 0; c < room.cols; c++) {
    if (wall(c, r)) continue;
    let radius = 0;
    while (radius < 6) {
      let clear = true;
      for (let dr = -radius - 1; dr <= radius + 1 && clear; dr++) for (let dc = -radius - 1; dc <= radius + 1; dc++) if (wall(c + dc, r + dr)) { clear = false; break; }
      if (!clear) break;
      radius++;
    }
    if (!best || radius > best.radius) best = { c, r, radius };
  }
  s.player.x = (best.c * 16 + 8) * 256;
  s.player.y = (best.r * 16 + 8) * 256;
  s.player.vx = 0;
  s.player.vy = 0;
`;
const quietRoom = new Function(`
  window.__iot.scene().session.run.state.room.timer = -1000000;
  ${OPEN_SPOT}
`);

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
  const open = async (
    viewport = { width: VIEW.w * ZOOM, height: VIEW.h * ZOOM },
    deviceScaleFactor = 1,
  ) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.error('page error:', e.message);
    });
    await page.goto(url);
    await page.waitForFunction(() => typeof window.__iot !== 'undefined');
    await page.evaluate(installPad);
    return page;
  };
  const shot = (page, name, clip) =>
    page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });
  /** Clip around the player (world → screen through the camera), in page pixels. */
  const clipAroundPlayer = async (page, w, h) => {
    const c = await page.evaluate(() => {
      const scene = window.__iot.scene();
      const cam = scene.cameras.main;
      const s = scene.session.run.state;
      return { x: s.player.x / 256 - cam.scrollX, y: s.player.y / 256 - cam.scrollY };
    });
    const x = Math.max(0, Math.min(VIEW.w - w, Math.round(c.x - w / 2)));
    const y = Math.max(0, Math.min(VIEW.h - h, Math.round(c.y - h / 2)));
    return { x: x * ZOOM, y: y * ZOOM, width: w * ZOOM, height: h * ZOOM };
  };
  const start = async (page, seed, quiet = true) => {
    await page.evaluate((seed) => window.__iot.startRun(seed), seed);
    await page.waitForFunction(() => window.__iot.scene() !== null && window.__iot.pose() !== null);
    if (quiet) await page.evaluate(quietRoom);
    await page.waitForTimeout(400);
  };
  const device = (page) => page.evaluate(() => window.__iot.device());
  /** Take the device to the pad (a left-stick flick, which no menu reads) or back to the mouse (a move). */
  const usePad = async (page) => {
    const axes = await page.evaluate(() => window.__pad.axes);
    await page.evaluate(setPad, { axes: [0, 0, 0, 0] });
    await page.waitForTimeout(60);
    await page.evaluate(setPad, { axes: [0.6, 0, 0, 0] });
    await page.waitForFunction(() => window.__iot.device() === 'gamepad');
    await page.evaluate(setPad, { axes });
  };
  const useMouse = async (page) => {
    await page.mouse.move(600, 300);
    await page.mouse.move(640, 320);
    await page.waitForFunction(() => window.__iot.device() === 'keyboard');
  };

  // --- C. Aim you can see on the gamepad -------------------------------------
  if (SECTIONS.includes('C')) {
    const page = await open();
    await start(page, 21);
    await page.evaluate(() => window.__iot.setSpeed(0.1));
    // Right stick aim toward the upper right: the reticle 32 px out, the Haul guide to its range.
    await page.evaluate(setPad, { axes: [0, 0, 0.9, -0.4] });
    await usePad(page);
    await page.waitForTimeout(600);
    await shot(page, 'pad-reticle-haul-guide', await clipAroundPlayer(page, 240, 140));
    // Soft lock: walking toward a Husk a few degrees off the stick snaps the reticle onto it.
    await page.evaluate(placeHusk, { kind: 'peeling', dx: 70, dy: 12 });
    await page.evaluate(setPad, { axes: [1, 0, 0, 0] });
    await page.waitForFunction(
      () => window.__iot.scene().controls.reticle()?.targetId !== null,
      undefined,
      { timeout: 5000 },
    );
    await page.evaluate(setPad, { axes: [0, 0, 0, 0] });
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => window.__iot.scene().controls.reticle());
    console.log('soft lock reticle:', JSON.stringify(r));
    await shot(page, 'pad-reticle-soft-lock', await clipAroundPlayer(page, 240, 140));
    // Haul on cooldown: the guide hides, the reticle stays.
    await page.evaluate(setPad, { axes: [0, 0, 0.9, -0.4] });
    await page.evaluate(() => {
      window.__iot.scene().session.run.state.husks.length = 0;
      window.__iot.scene().session.run.state.player.cooldowns[0] = 300;
    });
    await page.waitForTimeout(600);
    await shot(page, 'pad-reticle-haul-cooldown', await clipAroundPlayer(page, 240, 140));
    console.log('C device:', await device(page));
    await page.close();
  }

  // --- D. Hints follow the last-used device ----------------------------------
  if (SECTIONS.includes('D')) {
    const page = await open();
    await shot(page, 'start-keyboard');
    await usePad(page);
    await page.waitForTimeout(100);
    await shot(page, 'start-gamepad');
    await useMouse(page);
    await page.waitForTimeout(100);
    // The controls screen: the lit column and footer switch with the device.
    await page.keyboard.press('c');
    await page.waitForTimeout(300);
    await shot(page, 'controls-keyboard');
    await usePad(page);
    await page.waitForTimeout(100);
    await shot(page, 'controls-gamepad');
    // In a run: the HUD hints switch live, no scene change.
    await start(page, 22);
    await page.evaluate(() => window.__iot.setSpeed(0.02));
    await usePad(page);
    await page.waitForTimeout(200);
    await shot(page, 'hud-gamepad');
    await useMouse(page);
    await page.waitForTimeout(100);
    await shot(page, 'hud-keyboard');
    // The results screen.
    await page.evaluate(() => {
      const game = window.__iot.game;
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start('results', {
        seed: 22,
        weapon: 'hookblade',
        results: {
          status: 'cleared',
          ticks: 5400,
          kills: 27,
          perfectDodges: 3,
          sparkglassCollected: 31,
          sparkglassKept: 31,
          roomsCleared: 3,
        },
      });
    });
    await page.waitForTimeout(400);
    await shot(page, 'results-keyboard');
    await usePad(page);
    await page.waitForTimeout(100);
    await shot(page, 'results-gamepad');
    console.log('D device:', await device(page));
    await page.close();
  }

  // --- E. Start screen text at zoom 3 and 4, and at a fractional device pixel ratio ---
  if (SECTIONS.includes('E')) {
    for (const zoom of [3, 4]) {
      const page = await open({ width: VIEW.w * zoom, height: VIEW.h * zoom });
      await page.waitForTimeout(300);
      await shot(page, `start-after-zoom${zoom}`);
      await page.close();
    }
    // A 1920x1080 display at Windows 125% scaling: 1536x864 CSS px, DPR 1.25.
    const page = await open({ width: 1536, height: 864 }, 1.25);
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return {
        cssSize: [r.width, r.height],
        devicePxPerGamePx: (r.width * devicePixelRatio) / 480,
      };
    });
    console.log('E dpr 1.25:', JSON.stringify(info));
    await shot(page, 'start-after-dpr1.25');
    await page.close();
  }

  // --- F. The HUD never hides the room: the player in each corner of the largest room ---
  if (SECTIONS.includes('F')) {
    const page = await open();
    // The largest template (Shell Gallery, 32x19 tiles): find a seed that opens with it.
    let seed = 1;
    for (; seed < 200; seed++) {
      await page.evaluate((seed) => window.__iot.startRun(seed), seed);
      await page.waitForFunction(() => window.__iot.scene() !== null);
      const t = await page.evaluate(() => window.__iot.scene().session.run.state.room.template);
      if (t === 0) break;
    }
    await page.waitForFunction(() => window.__iot.pose() !== null);
    await page.evaluate(() => {
      window.__iot.scene().session.run.state.room.timer = -1000000;
      window.__iot.setSpeed(0.02);
    });
    const corners = await page.evaluate(() => {
      const s = window.__iot.scene().session.run.state;
      const room = s.room;
      const floor = (c, r) => '.PSC'.includes(room.tiles[r][c]);
      const pick = (cs, rs) => {
        for (const r of rs) for (const c of cs) if (floor(c, r)) return { c, r };
        return { c: 1, r: 1 };
      };
      const cols = [...Array(room.cols).keys()];
      const rows = [...Array(room.rows).keys()];
      return {
        'top-left': pick(cols, rows),
        'top-right': pick([...cols].reverse(), rows),
        'bottom-left': pick(cols, [...rows].reverse()),
        'bottom-right': pick([...cols].reverse(), [...rows].reverse()),
      };
    });
    for (const [name, { c, r }] of Object.entries(corners)) {
      await page.evaluate(
        ({ c, r }) => {
          const s = window.__iot.scene().session.run.state;
          s.player.x = (c * 16 + 8) * 256;
          s.player.y = (r * 16 + 8) * 256;
          s.player.vx = 0;
          s.player.vy = 0;
        },
        { c, r },
      );
      // Let the camera settle on the corner.
      await page.waitForTimeout(900);
      await shot(page, `hud-corner-${name}`);
    }
    // The player mid-room (floor under every panel) and a Husk under the top-left panel: that panel fades.
    await page.evaluate(() => {
      const s = window.__iot.scene().session.run.state;
      s.player.x = (s.room.cols * 16 * 256) / 2;
      s.player.y = (s.room.rows * 16 * 256) / 2;
      s.player.aim = 0;
    });
    await page.waitForTimeout(900);
    const panel = await page.evaluate(() => window.__iot.scene().hudRects().tl);
    const offset = await page.evaluate(() => {
      const scene = window.__iot.scene();
      const cam = scene.cameras.main;
      const s = scene.session.run.state;
      return { x: s.player.x / 256 - cam.scrollX, y: s.player.y / 256 - cam.scrollY };
    });
    await page.evaluate(placeHusk, {
      kind: 'peeling',
      dx: Math.round(panel.x + panel.w / 2 - offset.x),
      dy: Math.round(panel.y + panel.h / 2 - offset.y),
    });
    await page.waitForTimeout(400);
    await shot(page, 'hud-panel-fades-behind-husk');
    console.log('F seed', seed);
    await page.close();
  }

  // --- W. Text over the world (outlined) and the Haul guide stopping at a wall ---
  if (SECTIONS.includes('W')) {
    const page = await open();
    await start(page, 23);
    // A Husk in reach; one light press: the hit's floater, then the shell break.
    await page.evaluate(placeHusk, { kind: 'peeling', dx: 18, dy: 0, patch: { shell: [4] } });
    await page.evaluate(() => {
      window.__iot.setSpeed(1);
      let presses = 0;
      window.__iot.setInputSource((s) => {
        const p = s.player;
        if (p.action === 'idle' && presses < 1) {
          presses++;
          return 1 << 23; // Light
        }
        return 0;
      });
    });
    await page.waitForFunction(
      () => window.__iot.scene().session.run.state.stats.hitsLanded > 0,
      undefined,
      { timeout: 5000 },
    );
    await page.evaluate(() => window.__iot.setSpeed(0.02));
    await page.waitForTimeout(150);
    await shot(page, 'world-text-outlined', await clipAroundPlayer(page, 200, 120));
    // The room banner over the floor: clear the room's last wave so CLEARED shows.
    await start(page, 24);
    await page.evaluate(() => {
      const scene = window.__iot.scene();
      const s = scene.session.run.state;
      s.room.phase = 'fighting';
      s.room.wave = scene.session.run.params.run.rooms[0].waves.length - 1;
      s.husks.length = 0;
      window.__iot.setSpeed(1);
    });
    await page.waitForFunction(
      () => window.__iot.scene().session.run.state.room.phase === 'cleared',
    );
    await page.evaluate(() => window.__iot.setSpeed(0.02));
    await page.waitForTimeout(120);
    await shot(page, 'room-banner-outlined', {
      x: 100 * ZOOM,
      y: 60 * ZOOM,
      width: 280 * ZOOM,
      height: 70 * ZOOM,
    });
    // The Haul guide toward the nearest wall: it stops where the hook would snag.
    await start(page, 25);
    await page.evaluate(() => window.__iot.setSpeed(0.1));
    const aim = await page.evaluate(() => {
      // Aim at the nearest wall tile from the player.
      const s = window.__iot.scene().session.run.state;
      const room = s.room;
      const px = s.player.x / 256;
      const py = s.player.y / 256;
      let best = null;
      for (let r = 0; r < room.rows; r++)
        for (let c = 0; c < room.cols; c++) {
          if (!'#o'.includes(room.tiles[r][c])) continue;
          const d = Math.hypot(c * 16 + 8 - px, r * 16 + 8 - py);
          if (!best || d < best.d) best = { d, x: c * 16 + 8, y: r * 16 + 8 };
        }
      const a = Math.atan2(best.y - py, best.x - px);
      return [Math.cos(a) * 0.9, Math.sin(a) * 0.9];
    });
    await page.evaluate(setPad, { axes: [0, 0, aim[0], aim[1]] });
    await usePad(page);
    await page.waitForTimeout(600);
    await shot(page, 'haul-guide-stops-at-wall', await clipAroundPlayer(page, 240, 140));
    await page.close();
  }

  await browser.close();
  server.close();
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
