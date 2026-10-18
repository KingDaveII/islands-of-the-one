import { holdingLayout, holdingTemplate, pressedWrit, toWritView, type HoldingResponse } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  chipState,
  clockOffset,
  countOf,
  cycleProgress,
  cyclesDone,
  directionGlyphs,
  hudRects,
  interactPoint,
  lineParts,
  nearestPart,
  nearestStation,
  nearestStationPart,
  nearKesh,
  opaqueBoundsIn,
  packFill,
  panelsBehind,
  pluralName,
  propBase,
  propIdlePlays,
  purseGin,
  rectsOverlap,
  serverTime,
  standsOnGround,
  stationInitials,
  stationLines,
  takeFloat,
  takeResultLine,
  talkSpot,
  xpFraction,
} from './holdingView.js';

/**
 * The holding scene's logic (docs/design/holding.md): the ring and XP bar
 * values, the chip's states, the station panel's lines, the take-all line,
 * the prompt's station and the pack button.
 */
const T0 = Date.parse('2026-10-17T12:00:00.000Z');
const iso = (ms: number): string => new Date(T0 + ms).toISOString();
const working: HoldingResponse = {
  layoutId: 'first-holding',
  baskets: { 'writ-post': [], 'holding-store': [], 'weapon-rack': [], 'twisted-trees': [{ itemId: 'twisted-log', quantity: 3 }], 'stone-outcrop': [] },
  activity: { stationId: 'twisted-trees', startedAt: iso(0), cycleMs: 4000 },
  now: iso(13_000),
  skills: {
    woodcutting: { xp: 44, level: 2, into: 4, toNext: 1099 },
    mining: { xp: 0, level: 1, into: 0, toNext: 40 },
    farming: { xp: 0, level: 1, into: 0, toNext: 40 },
  },
  writ: toWritView(pressedWrit(T0), T0 + 13_000),
  kesh: { firstGiven: false, due: 'first', nextTideAt: new Date(T0 + 6 * 3_600_000).toISOString(), wordDue: false, seedsDue: false },
  words: [],
  plots: holdingLayout().plots.map((p) => ({ id: p.id, ground: null, virtue: null, namedAt: null, virtueSetAt: null, sownAt: null, kind: null, level: 1, state: 'lit' as const })),
  cycles: { 'twisted-trees': { cycleMs: 1_200_000, cycledUntil: iso(0), bonusPermille: 0 } },
};
const idle: HoldingResponse = { ...working, activity: null };
/** The same holding with plot-1 a sown field, plot-2 named but not sown, plot-3 a field with ישן on a faded line. */
const fields: HoldingResponse = {
  ...idle,
  baskets: { ...idle.baskets, 'plot-1': [{ itemId: 'pale-grain', quantity: 12 }], 'plot-2': [], 'plot-3': [{ itemId: 'pale-grain', quantity: 2 }], 'plot-4': [] },
  skills: { ...idle.skills, farming: { xp: 60, level: 2, into: 20, toNext: 1083 } },
  plots: [
    { id: 'plot-1', ground: 'adamah', virtue: null, namedAt: iso(0), virtueSetAt: null, sownAt: iso(0), kind: 'field', level: 1, state: 'lit' },
    { id: 'plot-2', ground: 'adamah', virtue: null, namedAt: iso(0), virtueSetAt: null, sownAt: null, kind: 'field', level: 1, state: 'lit' },
    { id: 'plot-3', ground: 'adamah', virtue: 'yashan', namedAt: iso(0), virtueSetAt: iso(0), sownAt: iso(0), kind: 'field', level: 1, state: 'faded' },
    { id: 'plot-4', ground: null, virtue: null, namedAt: null, virtueSetAt: null, sownAt: null, kind: null, level: 1, state: 'lit' },
  ],
  cycles: {
    'twisted-trees': { cycleMs: 1_200_000, cycledUntil: iso(0), bonusPermille: 0 },
    'plot-1': { cycleMs: 900_000, cycledUntil: iso(0), bonusPermille: 0 },
    'plot-3': { cycleMs: 900_000, cycledUntil: iso(0), bonusPermille: 30 },
  },
};

describe('the server clock and the cycle ring', () => {
  it('keeps the offset between the server and the client, and reads the server time from it', () => {
    expect(clockOffset(iso(13_000), T0 + 10_000)).toBe(3000);
    expect(clockOffset('soon', T0)).toBe(0);
    expect(serverTime(3000, T0 + 10_000)).toBe(T0 + 13_000);
  });

  it('draws the ring from the start, the cycle and the server time: 0 at a cycle boundary, under 1 just before one', () => {
    const a = working.activity;
    if (!a) throw new Error('no activity');
    expect(cycleProgress(a, T0)).toBe(0);
    expect(cycleProgress(a, T0 + 1000)).toBe(0.25);
    expect(cycleProgress(a, T0 + 3999)).toBeCloseTo(0.99975, 5);
    expect(cycleProgress(a, T0 + 4000)).toBe(0);
    expect(cycleProgress(a, T0 + 13_000)).toBe(0.25);
    // A clock behind the start (the server's answer arrived before the client clock caught up): still a fraction.
    expect(cycleProgress(a, T0 - 1000)).toBe(0.75);
    expect(cycleProgress({ ...a, cycleMs: 0 }, T0 + 1000)).toBe(0);
  });

  it('counts the cycles done for the "+1" prediction', () => {
    const a = working.activity;
    if (!a) throw new Error('no activity');
    expect(cyclesDone(a, T0 + 3999)).toBe(0);
    expect(cyclesDone(a, T0 + 4000)).toBe(1);
    expect(cyclesDone(a, T0 + 13_000)).toBe(3);
    expect(cyclesDone(a, T0 - 5000)).toBe(0);
  });
});

describe('the active-action chip', () => {
  it('is empty while idle, else the station icon, the skill and level, the ring and the XP bar', () => {
    expect(chipState(null, T0)).toBeNull();
    expect(chipState(idle, T0)).toBeNull();
    expect(chipState(working, T0 + 13_000)).toEqual({
      stationId: 'twisted-trees',
      initials: 'TT',
      skill: 'WOODCUTTING 2',
      ring: 0.25,
      xp: 4 / 1103,
    });
    expect(xpFraction({ xp: 0, level: 1, into: 0, toNext: 40 })).toBe(0);
    expect(xpFraction({ xp: 39, level: 1, into: 39, toNext: 1 })).toBe(0.975);
    expect(stationInitials('stone-outcrop')).toBe('SO');
    expect(stationInitials('writ-post')).toBe('WP');
  });
});

describe('the station panel', () => {
  it('names the station, its labelled rates, the basket, the skill, and the buttons; "You:" with the item\'s full name in place of By hand while working here', () => {
    expect(stationLines('twisted-trees', working)).toEqual({
      title: 'TWISTED TREES',
      letters: null,
      level: null,
      // Working here: the By hand line becomes the highlighted You line, so never three rate lines (GAME DESIGN 2026-10-18).
      rate: null,
      // The trees' trickle (Task 5): six trees at one log each every 2 h fill the shared basket one log every 20 min.
      cycle: 'By itself: 1 twisted log every 20 min',
      bonus: null,
      basket: 'Basket: 3 twisted logs',
      next: 'Next in 20 min',
      you: 'You: 1 twisted log every 4 s',
      skill: 'Woodcutting 2 · 1099 XP to next',
      note: null,
      work: 'STOP WORKING',
      take: 'TAKE ALL',
      working: true,
      buttons: ['work', 'take'],
    });
    expect(stationLines('twisted-trees', working, T0 + 13 * 60_000)?.next).toBe('Next in 7 min');
    expect(stationLines('stone-outcrop', working)).toEqual({
      title: 'STONE OUTCROP',
      letters: null,
      level: null,
      // The outcrop has no By itself line: stone never comes by itself.
      rate: 'By hand: 1 black stone every 6 s',
      cycle: null,
      bonus: null,
      basket: 'Basket: empty',
      next: null,
      you: null,
      skill: 'Mining 1 · 40 XP to next',
      note: null,
      work: 'WORK HERE',
      take: 'TAKE ALL',
      working: false,
      buttons: ['work', 'take'],
    });
    expect(stationLines('twisted-trees', null)?.skill).toBe('Woodcutting');
    expect(stationLines('twisted-trees', null)?.next).toBeNull();
    // The post and the store have no panel: Use opens the inventory with the store pane; the reserved rack has none either.
    expect(stationLines('writ-post', working)).toBeNull();
    expect(stationLines('holding-store', working)).toBeNull();
    expect(stationLines('weapon-rack', working)).toBeNull();
    expect(stationLines('field', working)).toBeNull();
    // An unnamed plot has no panel of this kind (Use opens the plot sentence panel).
    expect(stationLines('plot-1', working)).toBeNull();
    expect(stationLines('plot-1', null)).toBeNull();
    expect(countOf('twisted-log', 1)).toBe('1 twisted log');
    expect(countOf('black-stone', 12)).toBe('12 black stones');
    expect(pluralName('twisted-log')).toBe('twisted logs');
  });

  it("a field's panel (Task 5): the sentence, the level, both rates, the basket, \"Next in …\" and RENAME; not sown: the note and SOW; faded: the line and no buttons", () => {
    const now = T0 + 3 * 60_000;
    expect(stationLines('plot-1', fields, now)).toEqual({
      title: 'FIELD',
      letters: 'אדמה',
      level: 'Level 1',
      rate: 'By hand: 1 pale grain every 20 s',
      cycle: 'By itself: 1 pale grain every 15 min',
      bonus: null,
      basket: 'Basket: 12 pale grains',
      next: 'Next in 12 min',
      you: null,
      skill: 'Farming 2 · 1083 XP to next',
      note: null,
      work: 'WORK HERE',
      take: 'TAKE ALL',
      working: false,
      buttons: ['work', 'take', 'rename'],
    });
    expect(stationLines('plot-1', { ...fields, activity: { stationId: 'plot-1', startedAt: iso(0), cycleMs: 20_000 } }, now)).toMatchObject({
      rate: null,
      you: 'You: 1 pale grain every 20 s',
      work: 'STOP WORKING',
      working: true,
    });
    // Dark: "Resting" in place of "Next in …".
    const dark = { ...fields, writ: toWritView(pressedWrit(T0 - 60 * 3_600_000), T0) };
    expect(stationLines('plot-1', dark, now)?.next).toBe('Resting while your Writ is dark.');
    expect(stationLines('twisted-trees', dark, now)?.next).toBe('Resting while your Writ is dark.');
    // Not sown: only the note and SOW.
    expect(stationLines('plot-2', fields, now)).toEqual({
      title: 'FIELD',
      letters: 'אדמה',
      level: 'Level 1',
      rate: null,
      cycle: null,
      bonus: null,
      basket: null,
      next: null,
      you: null,
      skill: null,
      note: 'Not sown yet.',
      work: 'WORK HERE',
      take: 'TAKE ALL',
      working: false,
      buttons: ['sow'],
    });
    // Faded, with ישן: the sentence with its divider, the faded line, the basket kept, no buttons.
    expect(stationLines('plot-3', fields, now)).toEqual({
      title: 'FIELD',
      letters: 'אדמה · ישן',
      level: 'Level 1',
      rate: null,
      cycle: null,
      bonus: null,
      basket: 'Basket: 2 pale grains',
      next: null,
      you: null,
      skill: null,
      note: "Faded into the haze with your Writ's first line. Feed your Writ and it will remember.",
      work: 'WORK HERE',
      take: 'TAKE ALL',
      working: false,
      buttons: [],
    });
    // Lit again with the bonus: the +3% line under the cycle's rate.
    const lit = { ...fields, plots: fields.plots.map((p) => (p.id === 'plot-3' ? { ...p, state: 'lit' as const } : p)) };
    expect(stationLines('plot-3', lit, now)).toMatchObject({ bonus: '+3% for keeping its name', next: 'Next in 12 min', buttons: ['work', 'take', 'rename'] });
    // The chip at a field: the kind's initial and Farming.
    expect(chipState({ ...fields, activity: { stationId: 'plot-1', startedAt: iso(0), cycleMs: 20_000 } }, T0 + 5000)).toMatchObject({ initials: 'F', skill: 'FARMING 2', ring: 0.25 });
    expect(stationInitials('plot-1', fields)).toBe('F');
  });

  it("floats what a take-all moved as \"+3\" and keeps GAME DESIGN's full-store line as the one panel line; an empty basket says nothing", () => {
    const stuck = { stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 4 }], left: [{ itemId: 'twisted-log', quantity: 6 }] };
    expect(takeResultLine(stuck)).toBe('Store: twisted logs full.');
    expect(takeFloat(stuck)).toBe('+4');
    expect(takeResultLine({ stationId: 'twisted-trees', moved: [], left: [{ itemId: 'twisted-log', quantity: 6 }] })).toBe('Store: twisted logs full.');
    expect(takeFloat({ stationId: 'twisted-trees', moved: [], left: [{ itemId: 'twisted-log', quantity: 6 }] })).toBeNull();
    const taken = { stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 3 }], left: [] };
    expect(takeResultLine(taken)).toBeNull();
    expect(takeFloat(taken)).toBe('+3');
    // An empty basket: no line ("Basket: empty" is already on the panel) and no float.
    expect(takeResultLine({ stationId: 'stone-outcrop', moved: [], left: [] })).toBeNull();
    expect(takeFloat({ stationId: 'stone-outcrop', moved: [], left: [] })).toBeNull();
    expect(takeFloat({ stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 2 }, { itemId: 'black-stone', quantity: 5 }], left: [] })).toBe('+7');
  });
});

describe('the prompt and the props', () => {
  const layout = holdingLayout();
  const trees = layout.stations.find((s) => s.id === 'twisted-trees');
  const post = layout.stations.find((s) => s.id === 'writ-post');
  const rack = layout.stations.find((s) => s.id === 'weapon-rack');
  if (!trees || !post || !rack) throw new Error('no stations');
  const [tree0, , , tree3] = trees.parts;
  if (!tree0 || !tree3) throw new Error('no tree parts');

  it('prompts for the nearest station part whose interact point is in reach, by the sim distance; any tree works the trees', () => {
    expect(interactPoint(tree0)).toEqual({ x: 104, y: 56 });
    expect(nearestStationPart(104, 56, 40, layout)).toEqual({ id: 'twisted-trees', station: trees, plot: null, part: tree0 });
    expect(nearestStation(104 + 39, 56, 40, layout)?.id).toBe('twisted-trees');
    expect(nearestStation(104 + 41, 56, 40, layout)).toBeNull();
    // The fourth tree, by the start's row: the same station, another part.
    expect(interactPoint(tree3)).toEqual({ x: 104, y: 248 });
    expect(nearestStationPart(104, 248, 40, layout)).toEqual({ id: 'twisted-trees', station: trees, plot: null, part: tree3 });
    // Between the post's interact point (14, 14) and the start: the post is nearest.
    expect(nearestStation(232, 236, 40, layout)?.id).toBe('writ-post');
    // The store's interact point (12, 14) and the outcrop's (22, 14).
    expect(nearestStation(200, 232, 40, layout)?.id).toBe('holding-store');
    expect(nearestStation(360, 232, 40, layout)?.id).toBe('stone-outcrop');
    // The reserved rack offers no Use: standing on its interact point (16, 13) prompts for the post beside it, or nothing in a short range.
    expect(interactPoint(rack.parts[0] ?? tree0)).toEqual({ x: 264, y: 216 });
    expect(nearestStation(264, 216, 40, layout)?.id).toBe('writ-post');
    expect(nearestStation(264, 216, 10, layout)).toBeNull();
    expect(nearestStation(0, 0, 40, layout)).toBeNull();
    // The plots (Task 5) prompt at their signposts' interact points, only once the island has a Name (`plots` true).
    const plot1 = layout.plots[0];
    if (!plot1) throw new Error('no plot');
    expect(interactPoint(plot1.station)).toEqual({ x: 9.5 * 16, y: 10.5 * 16 });
    expect(nearestStationPart(152, 168, 40, layout)).toBeNull();
    expect(nearestStationPart(152, 168, 40, layout, true)).toEqual({ id: 'plot-1', station: null, plot: plot1, part: plot1.station });
    expect(nearestStation(152, 168, 40, layout)).toBeNull();
  });

  it("stands a prop on the bottom centre of its part's rectangle, and finds the part nearest a point", () => {
    expect(propBase(tree0)).toEqual({ x: 80, y: 64 });
    expect(propBase(tree3)).toEqual({ x: 80, y: 256 });
    expect(propBase(post.parts[0] ?? tree0)).toEqual({ x: 232, y: 224 });
    expect(nearestPart(trees, 80, 250)).toBe(tree3);
    expect(nearestPart(trees, 100, 40)).toBe(tree0);
    expect(nearestPart(post, 0, 0)).toBe(post.parts[0]);
  });

  it('fills the pack button and reads the purse from the inventory', () => {
    expect(packFill(null)).toBe('0/20');
    expect(packFill({ purse: [{ itemId: 'sealed-gin', quantity: 120 }], pack: [{ itemId: 'black-stone', quantity: 120 }], store: [], baskets: {} })).toBe('3/20');
    expect(purseGin({ purse: [{ itemId: 'sealed-gin', quantity: 120 }], pack: [], store: [], baskets: {} })).toBe(120);
    expect(purseGin(null)).toBe(0);
  });
});

describe('props in the void', () => {
  it("draws a grounding shadow for every station's prop but not for Kesh's rock", () => {
    const layout = holdingLayout();
    const template = holdingTemplate(layout);
    for (const station of layout.stations)
      for (const part of station.parts) expect([station.id, standsOnGround(template, part.rect)]).toEqual([station.id, true]);
    expect(standsOnGround(template, layout.kesh.rock)).toBe(false);
  });
});

describe('prop idles', () => {
  it('plays an idle of more than one frame (the Writ post pulse) and holds a one-frame one', () => {
    const anim = (n: number) => ({ anims: { idle: { frames: Array.from({ length: n }, (_, i) => `idle_${i}`), frameRate: 2, repeat: -1 } } });
    expect(propIdlePlays(anim(2))).toBe(true);
    expect(propIdlePlays(anim(1))).toBe(false);
    expect(propIdlePlays({ anims: {} })).toBe(false);
  });
});

describe('Kesh across the water (M2 Task 4b)', () => {
  const layout = holdingLayout();
  const spot = talkSpot(layout);

  it('the Talk spot is the centre of kesh.talk; the prompt reaches it like a station, and a nearer station keeps its prompt', () => {
    expect(spot).toEqual({ x: 23.5 * 16, y: 19.5 * 16 });
    expect(nearKesh(spot.x, spot.y, 40, layout)).toBe(true);
    expect(nearKesh(spot.x + 39, spot.y, 40, layout)).toBe(true);
    expect(nearKesh(spot.x + 41, spot.y, 40, layout)).toBe(false);
    // Standing by the outcrop's interact point (22, 14), with the Talk spot in a wide reach: the outcrop is nearer.
    const outcrop = { x: 22.5 * 16, y: 14.5 * 16 };
    expect(nearKesh(outcrop.x, outcrop.y + 8, 200, layout)).toBe(false);
    expect(nearKesh(spot.x, spot.y - 8, 200, layout)).toBe(true);
  });

  it("lays the HUD's four panels out from the frame and the measured texts", () => {
    const frame = { x: 0, y: 0, w: 480, h: 270 };
    const rects = hudRects(frame, { gin: 20, pack: 60, name: null, letters: 0, chip: 70 });
    expect(rects.writ).toEqual({ x: 8, y: 8, w: 78, h: 16 });
    expect(rects.purse).toEqual({ x: 480 - 8 - 41, y: 8, w: 41, h: 18 });
    expect(rects.chip).toEqual({ x: 240 - 61, y: 270 - 8 - 26, w: 122, h: 26 });
    expect(rects.pack).toEqual({ x: 480 - 8 - 68, y: 270 - 8 - 16, w: 68, h: 16 });
    // Named: the Name and its letters add their rows, and the widest of the three sets the width.
    expect(hudRects(frame, { gin: 20, pack: 60, name: 100, letters: 96, chip: 70 }).writ).toEqual({ x: 8, y: 8, w: 108, h: 37 });
    expect(rectsOverlap(rects.chip, rects.pack)).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
  });
});

describe('the HUD never hides the Kindled or Kesh (ART on #95)', () => {
  const rects = {
    writ: { x: 4, y: 4, w: 60, h: 30 },
    purse: { x: 440, y: 4, w: 36, h: 18 },
    chip: { x: 0, y: 0, w: 0, h: 0 },
    pack: { x: 420, y: 250, w: 56, h: 16 },
  };
  it('dithers the panels a body is behind, never an undrawn one', () => {
    expect(panelsBehind(rects, [])).toEqual([]);
    expect(panelsBehind(rects, [{ x: 430, y: 240, w: 12, h: 20 }])).toEqual(['pack']);
    expect(panelsBehind(rects, [{ x: 10, y: 10, w: 4, h: 4 }, { x: 450, y: 10, w: 4, h: 4 }])).toEqual(['writ', 'purse']);
    expect(panelsBehind(rects, [{ x: 0, y: 0, w: 4, h: 4 }])).toEqual([]);
    // Touching an edge is not behind.
    expect(panelsBehind(rects, [{ x: 64, y: 4, w: 4, h: 4 }])).toEqual([]);
  });

  it("finds a frame's opaque bounds in a sheet's pixels", () => {
    const width = 8;
    const data = new Uint8Array(width * 4 * 4);
    const ink = (x: number, y: number): void => {
      data[(y * width + x) * 4 + 3] = 255;
    };
    ink(5, 1);
    ink(6, 3);
    expect(opaqueBoundsIn({ width, data }, { x: 4, y: 0, w: 4, h: 4 })).toEqual({ x: 1, y: 1, w: 2, h: 3 });
    expect(opaqueBoundsIn({ width, data }, { x: 0, y: 0, w: 4, h: 4 })).toBeNull();
  });
});

describe("Kesh's stage directions read muted (ART on #95)", () => {
  const line = '(flicks the sliver across the water) "First one\'s free. Don\'t get used to it."';
  it('splits a line into what he does and what he says', () => {
    expect(lineParts(line)).toEqual([
      { text: '(flicks the sliver across the water)', direction: true },
      { text: ' "First one\'s free. Don\'t get used to it."', direction: false },
    ]);
    expect(lineParts('"Light. What\'s left of it."')).toEqual([{ text: '"Light. What\'s left of it."', direction: false }]);
    expect(lineParts('(snorts) a (shrugs) b')).toEqual([
      { text: '(snorts)', direction: true },
      { text: ' a ', direction: false },
      { text: '(shrugs)', direction: true },
      { text: ' b', direction: false },
    ]);
  });

  it("numbers the directions' glyphs as a wrapped BitmapText draws them: each wrap before a glyph shifts it down by one", () => {
    const text = 'ab (cd) ef (gh)';
    expect(directionGlyphs(text, text)).toEqual([3, 4, 5, 6, 11, 12, 13, 14]);
    // Wrapped after "(cd)": the space at 7 became a break that isn't drawn.
    expect(directionGlyphs(text, 'ab (cd)\nef (gh)')).toEqual([3, 4, 5, 6, 10, 11, 12, 13]);
  });
});
