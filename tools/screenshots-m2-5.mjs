#!/usr/bin/env node
/**
 * M2 Task 5 end to end (docs/screenshots/m2-5): plots, plot sentences and
 * the field. A new account and Kindled name the island: the four plots
 * appear round the post, and Kesh's after-naming lines end with his clay
 * tile in flight (its letters where it lands); the Words tab shows אדמה.
 * Use on a plot opens the plot sentence panel: אדמה chosen, its sigil; CONFIRM
 * plays the seal scene (slowed through the tuning for the mid-draw shot),
 * then the field with its seal and signpost, and Kesh's seeds (PACK 1/20).
 * The field's panel reads "Not sown yet." with SOW, then "Next in …";
 * WORK HERE sets Farming on the chip. `holding:away 48` fills the field's
 * basket with 192 grain and the trees' with 144 logs; TAKE ALL moves them.
 * `words:grant yashan` and a sealed gin let the plot be renamed אדמה · ישן
 * (the preview, then the seal with the divider). `writ:set` darkens the
 * Writ ("Resting while your Writ is dark."), then fades it: the plot fades.
 * Every state is checked through the API and the scene's snapshot. Shots are
 * whole-page screenshots at 1280 × 720.
 *
 * Needs the dev stack running on Postgres (`pnpm dev` with DATABASE_URL set).
 *
 *   pnpm dev   # in another shell
 *   node tools/screenshots-m2-5.mjs [outDir] [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] ?? join(ROOT, 'docs/screenshots/m2-5'));
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

const scenes = () =>
  page.evaluate(() => window.__iot?.game.scene.getScenes(true).map((s) => s.scene.key) ?? []);

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
      const res = await fetch(
        route,
        body
          ? {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {},
      );
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
  const seen = last
    ? {
        prompt: last.promptLabel,
        panel: last.panel,
        lines: last.panelLines,
        talk: last.talk?.text?.slice(0, 40),
        plots: last.plots,
        sealing: last.sealing,
        plotPanel: last.plotPanel,
        floats: last.floats,
        at: [last.state.x, last.state.y],
      }
    : null;
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
      .filter((o) => o.type === 'Container' && o.visible)
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

/** Click a line of text (a row of the plot sentence panel) on the holding's UI camera. */
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

const username = `plots${Date.now() % 100000}`;
const cli = (script, ...args) => {
  const out = execFileSync(
    'pnpm',
    ['--silent', '--filter', '@iot/server', script, '--', username, ...args],
    { cwd: ROOT, encoding: 'utf8' },
  );
  console.log(`  ${out.trim()}`);
};
const expectEq = (what, got, want) => {
  if (got !== want)
    throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
const setTuning = (patch) =>
  page.evaluate((patch) => {
    const t = window.__iot.tuning.get();
    const next = { ...t };
    for (const [k, v] of Object.entries(patch)) next[k] = { ...t[k], ...v };
    window.__iot.tuning.set(next);
  }, patch);
const resetTuning = () =>
  page.evaluate(() => {
    window.__iot.tuning.reset();
  });

/** The layout's points (sim px), from the data. */
const layout = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/holding.json'), 'utf8'))
  .layouts[0];
const kesh = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/kesh.json'), 'utf8'));
const words = JSON.parse(readFileSync(join(ROOT, 'packages/shared/data/words.json'), 'utf8')).words;
const adamah = words.find((w) => w.id === 'adamah');
const yashan = words.find((w) => w.id === 'yashan');
const centre = (p) => ({ x: (p.col + 0.5) * 16, y: (p.row + 0.5) * 16 });
const postUse = centre(layout.stations.find((s) => s.id === 'writ-post').parts[0].interact);
const plot = layout.plots[0];
const plotUse = centre(plot.station.interact);
const treeUse = centre(layout.stations.find((s) => s.id === 'twisted-trees').parts[3].interact);
console.log(
  `plot ${plot.id}: its interact point (${plot.station.interact.col}, ${plot.station.interact.row}) = (${plotUse.x}, ${plotUse.y}) sim px`,
);

/** Opens the panel at a plot (or station) by walking to its interact point and pressing Use. */
async function useAt(at, what) {
  await walkTo(at.x, at.y);
  await until((x) => x.promptLabel === 'USE', `the USE prompt at ${what}`);
  await page.keyboard.press('KeyE');
}

await page.goto(BASE);
await waitScene('account');
const setup = await page.evaluate(async (username) => {
  const post = (url, body) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const reg = await post('/api/register', { username, password: 'correct horse battery' });
  const k = await post('/api/kindled', { name: 'Iltani', remembrance: 'tide' });
  return [reg.status, k.status];
}, username);
if (setup.join() !== '201,201') throw new Error(`setup failed: ${setup.join()}`);
await page.reload();
await waitScene('start');
await page.keyboard.press('Enter');
await waitScene('holding');
let h = await until(
  (x) => x.response !== null && x.lettersLoaded,
  'the holding answered and the letter sheet loaded',
);
expectEq(
  'no plots before the Name',
  h.plots.every((p) => p.drawn === 'none'),
  true,
);
expectEq('no words yet', h.response.words.length, 0);
expectEq('no word due before the Name', h.response.kesh.wordDue, false);

// 1. The Name: the plots appear round the post; Kesh's after-naming lines play over them.
console.log('the Name:');
await useAt(postUse, 'the post');
await until((x) => x.nameScreen !== null, 'the Name screen');
await page.keyboard.type('Black Rock', { delay: 40 });
await until((x) => x.nameScreen?.letters === 'בלק רוק', 'the tablet heard the Name');
await page.keyboard.press('Enter');
h = await until(
  (x) => x.talk?.kind === 'line' && x.plots.every((p) => p.drawn === 'outline'),
  'the plots drawn as outlines under the after-naming lines',
);
expectEq('the first line', h.talk.text, kesh.afterNaming[0].text);
expectEq("Kesh's word is due", h.response.kesh.wordDue, true);
await shot('01-plots-after-the-name');

// 2. The tile in flight (the toss slowed through the tuning, as the F2 panel would), its letters where it lands.
console.log('the tile:');
await setTuning({ kesh: { tossMs: 2400 } });
for (let i = 0; i < 3; i++) await page.keyboard.press('KeyE');
await until(
  (x) => x.talk?.kind === 'line' && x.talk.text === kesh.afterNaming[3].text,
  'the toss line',
);
h = await until((x) => x.kesh.flight?.kind === 'word', 'the tile in the air', 100, 30);
console.log(`  mid-flight at ${JSON.stringify(h.kesh.flight)}`);
await page.screenshot({ path: join(OUT, '02-tile-in-flight.png') });
console.log('  02-tile-in-flight.png');
h = await until(
  (x) => x.floats.includes(adamah.letters),
  "the tile's letters where it landed",
  200,
  30,
);
expectEq('the word is known', h.response.words.join(), 'adamah');
expectEq('no longer due', h.response.kesh.wordDue, false);
await resetTuning();
await page.keyboard.press('KeyE');
await until((x) => x.talk === null && x.writPanel !== null, 'the Writ panel after the lines');
await page.keyboard.press('Escape');
await until((x) => x.writPanel === null, 'the panel closed');
const refused = await api('/api/kesh/word', {});
expectEq('asking again is refused', refused.body.error, 'not-due');

// 3. The Words tab with אדמה.
console.log('the Words tab:');
await page.keyboard.press('KeyI');
await waitScene('inventory');
for (let i = 0; i < 50; i++) {
  if (
    await page.evaluate(
      () =>
        window.__iot.game.scene.getScene('inventory').letterSheet !== null &&
        window.__iot.game.scene.getScene('inventory').words.length === 1,
    )
  )
    break;
  await sleep(100);
}
for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
const tab = await page.evaluate(() => window.__iot.game.scene.getScene('inventory').tab);
expectEq('the Words tab', tab, 'words');
await page.keyboard.press('ArrowDown');
await shot('03-words-tab', 500);
await page.keyboard.press('Escape');
await waitScene('holding');
await sleep(300);

// 4. The plot sentence panel: Use on the plot, אדמה chosen, the sigil.
console.log('the plot sentence:');
await useAt(plotUse, 'the plot');
h = await until((x) => x.plotPanel !== null, 'the plot sentence panel');
expectEq('naming', h.plotPanel.title, 'Name this plot');
expectEq('the first is free', h.plotPanel.cost, 'First naming: free');
expectEq(
  'one Ground to choose',
  h.plotPanel.choices.join('|'),
  `${adamah.say} · ${adamah.meaning}`,
);
expectEq('CONFIRM greyed without a Ground', h.plotPanel.confirmOn, false);
await clickText(`${adamah.say} · ${adamah.meaning}`);
h = await until((x) => x.plotPanel?.picked.ground === 'adamah', 'אדמה picked');
expectEq('Builds: Field', h.plotPanel.builds, 'Builds: Field');
expectEq('the sigil has four steps', h.plotPanel.sigilSteps, 4);
expectEq('CONFIRM lit', h.plotPanel.confirmOn, true);
await shot('04-plot-sentence-panel');

// 5. CONFIRM: the seal scene (slowed through the tuning), mid-draw.
console.log('the seal:');
await setTuning({
  plots: { sealRingMs: 1500, sealLetterMs: 400, sealSigilMs: 2000, sealGroundMs: 1000 },
});
await clickButton('CONFIRM');
h = await until((x) => x.sealing === plot.id, 'the seal scene', 100, 30);
expectEq('the panel closed', h.plotPanel, null);
expectEq('the plot is named', h.response.plots[0].ground, 'adamah');
expectEq('its state', h.response.plots[0].state, 'lit');
expectEq('the seeds are due', h.response.kesh.seedsDue, true);
await sleep(1900);
await page.screenshot({ path: join(OUT, '05-seal-scene-mid-draw.png') });
console.log('  05-seal-scene-mid-draw.png');
await resetTuning();

// 7. After the seal: Kesh's seeds (the toss, "+4", PACK 1/20), then his lines.
console.log('the seeds:');
h = await until(
  (x) => x.sealing === null && x.talk?.kind === 'line',
  "Kesh's seeds line after the seal",
  200,
);
expectEq('the seeds line', h.talk.text, kesh.afterFirstPlot[0].text);
await setTuning({ kesh: { tossMs: 2400 } });
await until((x) => x.kesh.flight?.kind === 'seeds', 'the seeds in the air', 100, 30);
await page.screenshot({ path: join(OUT, '07-seeds-toss.png') });
console.log('  07-seeds-toss.png');
h = await until((x) => x.floats.includes(`+${kesh.gifts.seeds.quantity}`), 'the "+4"', 200, 30);
let r = await api('/api/inventory');
expectEq('four seeds in the pack', r.body.pack.find((e) => e.itemId === 'grey-seeds')?.quantity, 4);
expectEq('the seeds no longer due', h.response.kesh.seedsDue, false);
await until((x) => x.floats.length === 0, 'the float gone', 100, 50);
await shot('07b-seeds-landed-pack-1-of-20', 100);
await resetTuning();
// The hint, Kesh's stand-in line and the Narrator, then the box closes.
for (let i = 1; i < kesh.afterFirstPlot.length; i++) {
  await page.keyboard.press('KeyE');
  await until(
    (x) => x.talk?.text === kesh.afterFirstPlot[i].text,
    `line ${i + 1} of afterFirstPlot`,
  );
}
await page.keyboard.press('KeyE');
await until((x) => x.talk === null, 'the lines over');

// 6. The field with its seal and signpost, from beside the post (the Kindled off the plot's centre).
console.log('the field:');
await walkTo(postUse.x, postUse.y);
h = await holding();
expectEq('drawn as named', h.plots[0].drawn, 'named');
expectEq('its letters', h.plots[0].letters, adamah.letters);
await shot('06-field-sealed');

// 8. "Not sown yet." with SOW; then the field's panel with "Next in …".
console.log('sowing:');
await useAt(plotUse, 'the field');
h = await until((x) => x.panel === plot.id, "the field's panel");
expectEq('the title', h.panelLines.title, 'FIELD');
expectEq('not sown', h.panelLines.note, 'Not sown yet.');
expectEq('SOW alone', h.panelLines.buttons.join(), 'sow');
await shot('08-not-sown-yet');
await clickButton('SOW');
h = await until((x) => x.panelLines?.next?.startsWith('Next in'), 'the cycle clock running');
expectEq('the cycle', h.panelLines.cycle, 'By itself: 1 pale grain every 15 min');
expectEq('the action', h.panelLines.rate, 'By hand: 1 pale grain every 20 s');
expectEq('the buttons', h.panelLines.buttons.join(), 'work,take,rename');
r = await api('/api/inventory');
expectEq('one seed spent', r.body.pack.find((e) => e.itemId === 'grey-seeds')?.quantity, 3);
console.log(`  ${h.panelLines.next}`);
await shot('08b-field-panel-next-in');

// 9. Working the field: the chip, Farming.
console.log('working:');
await clickButton('WORK HERE');
h = await until((x) => x.chip?.skill === 'FARMING 1', 'Farming on the chip');
expectEq('the action is at the field', h.response.activity.stationId, plot.id);
await page.keyboard.press('Escape');
await until((x) => x.panel === null, 'the panel closed');
await shot('09-working-the-field');
// Stop before going away, so the basket holds the cycles alone.
await useAt(plotUse, 'the field');
await until((x) => x.panel === plot.id, 'the panel');
await clickButton('STOP WORKING');
await until((x) => x.response?.activity === null, 'stopped');
await page.keyboard.press('Escape');

// 10. 48 h away: the field's basket holds 192 grain, the trees' 144 logs.
console.log('away:');
cli('holding:away', '48');
r = await api('/api/holding');
expectEq("the field's basket", r.body.baskets[plot.id]?.[0]?.quantity, 192);
expectEq("the trees' basket", r.body.baskets['twisted-trees']?.[0]?.quantity, 144);
expectEq('no XP for the trickle', r.body.skills.farming.xp, 0);
console.log(
  `  baskets: ${Object.entries(r.body.baskets)
    .map(([k, v]) => `${k} ${v.map((e) => `${e.quantity} ${e.itemId}`).join(', ')}`)
    .join('; ')}`,
);
await useAt(plotUse, 'the field');
await until((x) => x.panelLines?.basket === 'Basket: 192 pale grains', 'the basket line');
await shot('10-away-48h-basket-192');
await page.keyboard.press('Escape');
await useAt(treeUse, 'a tree');
h = await until(
  (x) => x.panelLines?.basket === 'Basket: 144 twisted logs',
  "the trees' basket line",
);
expectEq("the trees' cycle", h.panelLines.cycle, 'By itself: 1 twisted log every 20 min');
await shot('10b-trees-basket-144');
await page.keyboard.press('Escape');

// 11. Take all.
console.log('take all:');
await useAt(plotUse, 'the field');
await until((x) => x.panel === plot.id, 'the panel');
await clickButton('TAKE ALL');
await until((x) => x.floats.includes('+192'), 'the "+192"', 100, 30);
r = await api('/api/inventory');
expectEq(
  'the grain in the store',
  r.body.store.find((e) => e.itemId === 'pale-grain')?.quantity,
  192,
);
await page.screenshot({ path: join(OUT, '11-take-all.png') });
console.log('  11-take-all.png');
await page.keyboard.press('Escape');

// 12. ישן by the CLI, the rename's preview, the sealed אדמה · ישן with the divider.
console.log('the Virtue:');
cli('words:grant', 'yashan');
cli('inv:grant', 'sealed-gin', '1');
await useAt(plotUse, 'the field');
await until((x) => x.panel === plot.id, 'the panel');
await clickButton('RENAME');
h = await until((x) => x.plotPanel?.title === 'Rename this plot', 'the rename panel');
expectEq('the cost', h.plotPanel.cost, 'Renaming: 1 sealed gin');
expectEq('unchanged: CONFIRM greyed', h.plotPanel.confirmOn, false);
const virtueBox = await page.evaluate(() => window.__iot.holdingScene().plotPanel.slotBoxes.virtue);
const vb = await uiToPage(virtueBox.x + 32, virtueBox.y + 12);
await page.mouse.click(vb.x, vb.y);
h = await until((x) => x.plotPanel?.slot === 'virtue', 'the Virtue slot');
expectEq('None, then ישן', h.plotPanel.choices.join('|'), `None|${yashan.say} · ${yashan.meaning}`);
await clickText(`${yashan.say} · ${yashan.meaning}`);
h = await until((x) => x.plotPanel?.picked.virtue === 'yashan', 'ישן picked');
expectEq(
  'the effect line',
  h.plotPanel.effect,
  '+1% yield for each day it keeps its name, up to +20%',
);
expectEq('seven steps with the divider', h.plotPanel.sigilSteps, 7);
expectEq('CONFIRM lit', h.plotPanel.confirmOn, true);
await shot('12-rename-preview');
await clickButton('CONFIRM');
h = await until((x) => x.sealing === plot.id, 'the seal scene again', 100, 30);
expectEq('the Virtue set', h.response.plots[0].virtue, 'yashan');
r = await api('/api/inventory');
expectEq('the gin spent', r.body.purse.find((e) => e.itemId === 'sealed-gin')?.quantity ?? 0, 0);
h = await until((x) => x.sealing === null, 'the seal done', 100);
expectEq(
  'the sentence with the divider',
  h.plots[0].letters,
  `${adamah.letters} · ${yashan.letters}`,
);
await shot('12b-sealed-with-divider');

// 13. A dark Writ: "Resting".
console.log('dark:');
cli('writ:set', '--dark-hours', '1');
await useAt(plotUse, 'the field');
h = await until(
  (x) => x.panelLines?.next === 'Resting while your Writ is dark.',
  'the resting line',
);
expectEq('the plot is dark, not faded', h.response.plots[0].state, 'dark');
await shot('13-dark-writ-resting');
await page.keyboard.press('Escape');

// 14. A faded plot: the line's fade after the grace.
console.log('faded:');
cli('writ:set', '--dark-hours', '49');
r = await api('/api/holding');
expectEq('the plot faded', r.body.plots[0].state, 'faded');
await walkTo(postUse.x, postUse.y);
// The scene redraws from its next answer (the heartbeat, or an interaction): ask now.
await page.evaluate(() => {
  window.__iot.holdingScene().refresh();
});
await until((x) => x.plots[0].drawn === 'faded', 'the plot drawn faded');
await shot('14-faded-plot');
await useAt(plotUse, 'the field');
h = await until(
  (x) =>
    x.panelLines?.note ===
    "Faded into the haze with your Writ's first line. Feed your Writ and it will remember.",
  'the faded panel',
);
expectEq('no buttons', h.panelLines.buttons.length, 0);
const fadedRefusal = await api('/api/plots/name', {
  plotId: plot.id,
  ground: 'adamah',
  virtue: null,
});
expectEq('naming refused while faded', fadedRefusal.body.error, 'faded');
await shot('14b-faded-panel');

await browser.close();
