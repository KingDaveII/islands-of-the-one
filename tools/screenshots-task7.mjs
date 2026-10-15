#!/usr/bin/env node
/**
 * Historical (M1/M2): this script assumes M1's 480 × 270 canvas at a CSS
 * zoom. Since G1.5 (the canvas at device resolution, a world and a UI camera)
 * it no longer runs as-is; its shots stay the record of their task.
 * tools/screenshots-g15.mjs is the current script.
 *
 * Sprite screenshots for docs/screenshots/m1-task7 (sprites.md §9 brought to
 * the engine): a Peeling and a Nutshell spawning, the Haul throw → recover,
 * the Nutshell's walk and slam, the Kindled's hit flinch → stagger, and the
 * start screen with its menu keys as glyphs. Runs the built client in
 * headless Chromium through the `window.__iot` playtest hooks, with the sim
 * state patched to put each animation on screen.
 *
 *   pnpm --filter @iot/client build && node tools/screenshots-task7.mjs [outDir]
 *   python3 tools/screenshot-strips.py docs/screenshots/m1-task7
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps/client/dist');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m1-task7'));
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
  const page = await browser.newPage({
    viewport: { width: VIEW.w * ZOOM, height: VIEW.h * ZOOM },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('page error:', e.message);
  });
  await page.goto(url);
  await page.waitForFunction(() => typeof window.__iot !== 'undefined');

  /** A quiet run that opens in Shell Gallery (template 0, the roomiest floor), from the first seed at or after `seed` that does. */
  const start = async (seed) => {
    for (let s = seed; s < seed + 100; s++) {
      await page.evaluate((s) => window.__iot.startRun(s), s);
      await page.waitForFunction(() => window.__iot.scene() !== null);
      if ((await page.evaluate(() => window.__iot.scene().session.run.state.room.template)) === 0)
        break;
    }
    await page.waitForFunction(() => window.__iot.pose() !== null);
    await page.evaluate(quietRoom);
    await page.evaluate(() => window.__iot.setSpeed(1));
  };
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
  const state = () =>
    page.evaluate(() => {
      const s = window.__iot.scene().session.run.state;
      return {
        action: s.player.action,
        t: s.player.t,
        pose: window.__iot.pose(),
        husks: s.husks.map((h) => ({
          action: h.action,
          t: h.t,
          vx: h.vx,
          vy: h.vy,
          dx: Math.round((h.x - s.player.x) / 256),
          dy: Math.round((h.y - s.player.y) / 256),
        })),
        huskPoses: window.__iot.huskPoses(),
      };
    });
  const shot = async (name, clip) => {
    await page.screenshot({
      path: join(OUT, `${name}.png`),
      clip: clip ?? (await clipAroundPlayer(160, 110)),
    });
    const st = await state();
    const husk = st.husks[0] ? ` husk ${st.husks[0].action} t${st.husks[0].t}` : '';
    console.log(`${name}: ${st.pose.anim} #${st.pose.frame} (player ${st.action} t${st.t})${husk}`);
  };
  const waitFor = async (fn, arg, timeout = 15000) => {
    try {
      await page.waitForFunction(fn, arg, { polling: 'raf', timeout });
    } catch (e) {
      console.error('waited for', fn.toString(), 'state:', JSON.stringify(await state()));
      throw e;
    }
  };
  /** Freeze the sim and show the pose for a patched state. */
  const freeze = () => page.evaluate(() => window.__iot.setSpeed(0));

  // 1. Spawning: three stages of each kind, the sim frozen at each.
  for (const kind of ['peeling', 'nutshell']) {
    await start(kind === 'peeling' ? 1 : 2);
    const id = await page.evaluate(placeHusk, {
      kind,
      dx: 40,
      dy: 0,
      patch: { action: 'spawn', t: 0 },
    });
    const spawn = await page.evaluate(
      ({ kind }) => window.__iot.scene().session.run.params.husks[kind].spawn,
      { kind },
    );
    await freeze();
    for (const [i, f] of [0, 0.4, 0.75].entries()) {
      await page.evaluate(
        ({ id, t }) => {
          const h = window.__iot.scene().session.run.state.husks.find((x) => x.id === id);
          h.t = t;
        },
        { id, t: Math.floor(spawn * f) },
      );
      await page.waitForTimeout(80);
      await shot(`spawn-${kind}-${i}`, await clipAroundPlayer(120, 80));
    }
  }

  // 2. The Haul throw → recover: a throw into open floor (a miss), each phase caught.
  await start(3);
  await page.evaluate(() => {
    window.__iot.setSpeed(0.25);
    let pressed = false;
    window.__iot.setInputSource(() => {
      if (pressed) return 0;
      pressed = true;
      return (8 << 23) >>> 0; // Ability1 (the Haul), aim east
    });
  });
  await waitFor(
    () => window.__iot.pose()?.anim.startsWith('haul_throw') && window.__iot.pose()?.frame === 0,
  );
  await shot('haul-1-throw', await clipAroundPlayer(200, 110));
  await waitFor(
    () => window.__iot.pose()?.anim.startsWith('haul_throw') && window.__iot.pose()?.frame === 1,
  );
  await shot('haul-2-flying', await clipAroundPlayer(200, 110));
  await waitFor(
    () => window.__iot.pose()?.anim.startsWith('haul_recover') && window.__iot.pose()?.frame === 0,
  );
  await shot('haul-3-recover-0', await clipAroundPlayer(200, 110));
  await waitFor(
    () => window.__iot.pose()?.anim.startsWith('haul_recover') && window.__iot.pose()?.frame === 1,
  );
  await shot('haul-4-recover-1', await clipAroundPlayer(200, 110));

  // 3. The Nutshell's walk (two frames of the chase) and slam (dropping, impact, held through the recovery).
  await start(4);
  await page.evaluate(placeHusk, { kind: 'nutshell', dx: 72, dy: 0 });
  await page.evaluate(() => {
    window.__iot.setSpeed(0.25);
    window.__iot.setInputSource(() => 0);
  });
  await waitFor(
    () => window.__iot.huskPoses()[0]?.anim === 'walk' && window.__iot.huskPoses()[0]?.frame === 1,
  );
  await shot('nutshell-walk-1', await clipAroundPlayer(200, 110));
  await waitFor(
    () => window.__iot.huskPoses()[0]?.anim === 'walk' && window.__iot.huskPoses()[0]?.frame === 3,
  );
  await shot('nutshell-walk-3', await clipAroundPlayer(200, 110));
  // The slam: put it in range, winding up with the telegraph nearly done.
  await page.evaluate(() => {
    const scene = window.__iot.scene();
    const s = scene.session.run.state;
    const P = scene.session.run.params;
    const h = s.husks[0];
    h.x = s.player.x + 26 * 256;
    h.y = s.player.y;
    h.vx = 0;
    h.vy = 0;
    h.action = 'windup';
    h.t = P.husks.nutshell.startup - 2;
    h.attackDir = 2048;
    s.player.hp = 1000;
    window.__iot.setSpeed(0.1);
  });
  await waitFor(
    () => window.__iot.huskPoses()[0]?.anim === 'slam' && window.__iot.huskPoses()[0]?.frame === 0,
  );
  await shot('nutshell-slam-0', await clipAroundPlayer(200, 110));
  await waitFor(
    () => window.__iot.huskPoses()[0]?.anim === 'slam' && window.__iot.huskPoses()[0]?.frame === 1,
  );
  await shot('nutshell-slam-1', await clipAroundPlayer(200, 110));
  await waitFor(() => window.__iot.scene().session.run.state.husks[0]?.action === 'recover');
  await shot('nutshell-slam-2-recover', await clipAroundPlayer(200, 110));

  // 4. The Kindled hit: the flinch, then the stagger held to the end of the stun (a Peeling's lunge lands).
  await start(5);
  await page.evaluate(placeHusk, {
    kind: 'peeling',
    dx: 30,
    dy: 0,
    patch: { action: 'windup', t: 20, attackDir: 2048 },
  });
  await page.evaluate(() => {
    window.__iot.setSpeed(0.1);
    window.__iot.setInputSource(() => 0);
  });
  await waitFor(
    () => window.__iot.pose()?.anim.startsWith('hit') && window.__iot.pose()?.frame === 0,
  );
  // The post-hit invulnerability flickers the sprite on alternate ticks: switch it off so both hit frames are in the shots.
  await page.evaluate(() => {
    window.__iot.scene().session.run.state.player.hurtInvuln = 0;
  });
  await page.waitForTimeout(60);
  await shot('hit-0-flinch', await clipAroundPlayer(160, 110));
  await waitFor(
    () => window.__iot.pose()?.anim.startsWith('hit') && window.__iot.pose()?.frame === 1,
  );
  // The post-hit invulnerability flickers the sprite on alternate ticks: switch it off so the stagger frame is in the shot.
  await page.evaluate(() => {
    window.__iot.scene().session.run.state.player.hurtInvuln = 0;
  });
  await page.waitForTimeout(60);
  await shot('hit-1-stagger', await clipAroundPlayer(160, 110));

  // 5. The start screen: the menu keys as glyphs.
  await page.evaluate(() => {
    const game = window.__iot.game;
    game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
    game.scene.start('start');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'start-keyboard.png') });

  await browser.close();
  server.close();
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`);
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
