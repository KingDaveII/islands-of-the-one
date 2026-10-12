#!/usr/bin/env node
/**
 * Sprite screenshots for docs/screenshots (M1 Task 5): the 8 facings of walk,
 * a heavy charge → thrust → hold sequence, a Haul throw and pull, a Nutshell
 * regrow. Runs the client in headless Chromium through the `window.__iot`
 * playtest hooks: a run with scripted input, the sim state patched to put a
 * Husk where the shot needs one, quarter speed so each window is caught.
 *
 *   pnpm --filter @iot/client build && node tools/screenshots.mjs [outDir]
 *
 * Needs playwright-core (a root devDependency) and a Chromium: the one
 * Playwright installed (PLAYWRIGHT_BROWSERS_PATH) or CHROMIUM_PATH.
 */
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/client/dist');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots'));
const ZOOM = 2;
const VIEW = { w: 480, h: 270 };

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

/** A static server for the built client (vite preview without the CLI). */
async function serve(dir) {
  const { readFile } = await import('node:fs/promises');
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

// --- In-page scripts (serialized into the browser) --------------------------

/** Patch a Husk into the run next to the player (world px offsets); returns its id. */
const placeHusk = ({ kind, dx, dy, patch = {} }) => {
  const scene = window.__iot.scene();
  const run = scene.session.run;
  const s = run.state;
  const P = run.params;
  const hp = P.husks[kind];
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

/** Freeze the room so no wave spawns, and put the player in the middle of it. */
/** Put the player on the floor tile with the most open space around it (3 tiles each way), still. */
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
const centerPlayer = new Function(OPEN_SPOT);
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
  const page = await browser.newPage({
    viewport: { width: VIEW.w * ZOOM, height: VIEW.h * ZOOM },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => typeof window.__iot !== 'undefined');

  const start = async (seed, quiet = true) => {
    await page.evaluate((seed) => window.__iot.startRun(seed), seed);
    await page.waitForFunction(() => window.__iot.scene() !== null && window.__iot.pose() !== null);
    if (quiet) await page.evaluate(quietRoom);
    await page.evaluate(() => window.__iot.setSpeed(1));
  };
  const state = () =>
    page.evaluate(() => {
      const s = window.__iot.scene().session.run.state;
      return {
        action: s.player.action,
        t: s.player.t,
        charge: s.player.charge,
        hook: s.player.hook,
        husks: s.husks.map((h) => ({ action: h.action, shell: h.shell })),
        pose: window.__iot.pose(),
      };
    });
  /** Clip around the player (world → screen through the camera), in page pixels. */
  const clipAroundPlayer = async (w, h) => {
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
  const shot = async (name, clip) => {
    const path = join(OUT, `${name}.png`);
    await page.screenshot({ path, clip: clip ?? (await clipAroundPlayer(160, 110)) });
    const st = await state();
    const husk = st.husks[0]
      ? ` husk ${st.husks[0].action} shell ${st.husks[0].shell.join('/')}`
      : '';
    console.log(`${name}: ${st.pose.anim} #${st.pose.frame} (player ${st.action} t${st.t})${husk}`);
  };
  const waitFor = (fn, arg, timeout = 15000) =>
    page.waitForFunction(fn, arg, { polling: 'raf', timeout });

  // 1. The 8 facings of walk: move and aim in each direction for a moment.
  await start(1);
  for (const [i, facing] of ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'].entries()) {
    const angle = [1024, 512, 0, 3584, 3072, 2560, 2048, 1536][i];
    await page.evaluate(centerPlayer);
    await page.evaluate((angle) => {
      window.__iot.setInputSource(() => {
        // aim | moveDir << 12 | moveMag << 20 (input.ts), moving toward the aim.
        const moveDir = Math.round(angle / 16) & 0xff;
        return ((angle & 0xfff) | (moveDir << 12) | (7 << 20)) >>> 0;
      });
    }, angle);
    await waitFor(
      (f) => window.__iot.pose()?.anim === `walk_${f}` && window.__iot.pose()?.frame >= 1,
      facing,
    );
    await shot(`walk-${i}-${facing}`, await clipAroundPlayer(72, 64));
    // Stand still between directions so each clip starts from rest.
    await page.evaluate(() => window.__iot.setInputSource(() => 0));
    await waitFor(() => window.__iot.pose()?.anim.startsWith('idle_'));
  }

  // 2. Heavy: charge (held until full) → thrust → hold on a pinned Husk.
  await start(2);
  await page.evaluate(placeHusk, { kind: 'nutshell', dx: 34, dy: 0 });
  await page.evaluate(() => {
    window.__iot.setSpeed(0.25);
    let released = false;
    window.__iot.setInputSource((s, P) => {
      const p = s.player;
      const h = s.husks[0];
      // Aim at the Husk (1/4096 turn, screen y down), like the autopilot does.
      const aim = h
        ? ((Math.round((Math.atan2(h.y - p.y, h.x - p.x) / (2 * Math.PI)) * 4096) % 4096) + 4096) %
          4096
        : 0;
      if (released) return aim;
      // Heavy is bit 1 of the buttons (<< 23): hold it, release once the charge has been full for a moment.
      if (p.action === 'charge' && p.t >= P.weapon.heavy.chargeMax + 20) {
        released = true;
        return aim;
      }
      return (aim | (2 << 23)) >>> 0;
    });
  });
  await waitFor(() => {
    const s = window.__iot.scene().session.run.state;
    return s.player.action === 'charge' && s.player.charge >= 36;
  });
  await shot('heavy-1-charge');
  await waitFor(() => window.__iot.pose()?.anim.startsWith('heavy_thrust'));
  await shot('heavy-2-thrust');
  await waitFor(() => window.__iot.pose()?.anim.startsWith('heavy_hold'));
  await shot('heavy-3-hold');
  await waitFor(() => window.__iot.pose()?.anim.startsWith('heavy_recover'));
  await shot('heavy-4-recover');

  // 3. Haul: the throw (hook in flight) and the pull of a light Husk.
  await start(3);
  await page.evaluate(placeHusk, { kind: 'peeling', dx: 64, dy: 0 });
  await page.evaluate(() => {
    window.__iot.setSpeed(0.25);
    let pressed = false;
    window.__iot.setInputSource((s) => {
      const p = s.player;
      const h = s.husks[0];
      const aim = h
        ? ((Math.round((Math.atan2(h.y - p.y, h.x - p.x) / (2 * Math.PI)) * 4096) % 4096) + 4096) %
          4096
        : 0;
      if (pressed) return aim;
      pressed = true;
      return (aim | (8 << 23)) >>> 0; // Ability1 (the Haul)
    });
  });
  await page.evaluate(() => window.__iot.setSpeed(0.1));
  await waitFor(() => {
    const p = window.__iot.scene().session.run.state.player;
    return p.hook !== null && p.hook.hitId < 0 && p.hook.travel > 12 * 256;
  });
  await shot('haul-1-throw', await clipAroundPlayer(200, 110));
  await page.evaluate(() => window.__iot.setSpeed(0.25));
  await waitFor(() => window.__iot.pose()?.anim.startsWith('haul_pull'));
  await shot('haul-2-pull', await clipAroundPlayer(200, 110));

  // 3b. Haul on a heavy Husk: the player slides along the chain.
  await start(4);
  await page.evaluate(placeHusk, { kind: 'nutshell', dx: 64, dy: 0 });
  await page.evaluate(() => {
    window.__iot.setSpeed(0.25);
    let pressed = false;
    window.__iot.setInputSource((s) => {
      const p = s.player;
      const h = s.husks[0];
      const aim = h
        ? ((Math.round((Math.atan2(h.y - p.y, h.x - p.x) / (2 * Math.PI)) * 4096) % 4096) + 4096) %
          4096
        : 0;
      if (pressed) return aim;
      pressed = true;
      return (aim | (8 << 23)) >>> 0; // Ability1 (the Haul)
    });
  });
  await waitFor(() => window.__iot.pose()?.anim.startsWith('haul_slide'));
  await shot('haul-3-slide', await clipAroundPlayer(200, 110));

  // 4. A Nutshell regrow: its inner shell damaged, the regrow timer about to fire.
  await start(5);
  await page.evaluate(
    (id) => {
      const P = window.__iot.scene().session.run.params;
      const s = window.__iot.scene().session.run.state;
      const h = s.husks.find((x) => x.id === id);
      h.shell = [0, 5];
      h.sinceHit = P.husks.nutshell.innerRegrow - 30;
      window.__iot.setSpeed(0.25);
      window.__iot.setInputSource(() => 0);
    },
    await page.evaluate(placeHusk, { kind: 'nutshell', dx: 40, dy: 0 }),
  );
  await shot('regrow-0-chipped-outer', await clipAroundPlayer(140, 100));
  await waitFor(() => {
    const h = window.__iot.scene().session.run.state.husks[0];
    return h && h.shell[1] === 20;
  });
  for (let i = 1; i <= 3; i++) {
    await shot(`regrow-${i}`, await clipAroundPlayer(140, 100));
    await page.waitForTimeout(420);
  }

  // 5. A whole frame with the debug hitbox shapes over the sprites (F3), for the record.
  await start(6, false);
  await page.evaluate(() => {
    window.__iot.setAutopilot({});
  });
  await waitFor(
    () => window.__iot.scene().session.run.state.husks.some((h) => h.action !== 'spawn'),
    undefined,
    30000,
  );
  await page.evaluate(() => {
    window.__iot.setSpeed(0.25);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, 'room-sprites.png') });
  await page.evaluate(() => {
    window.__iot.setDebugShapes(true);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(OUT, 'room-debug-shapes.png') });

  await browser.close();
  server.close();
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
