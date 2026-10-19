import { defaultTuning, holdingLayout, PLOT_TEXT, wordDef, type LayoutPlot, type WordDef } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  bonusLine,
  cycleRateLine,
  cyclesLanded,
  effectLine,
  groundElement,
  lettersBand,
  namedPlotIds,
  nextInLine,
  nextInWords,
  noWordsLine,
  plotAtWorld,
  plotPanelLines,
  plotWorldRect,
  ringPixels,
  ringRect,
  sealDurationMs,
  sealPhase,
  sentenceLetters,
  sentenceSigil,
  sentenceStyle,
  onSignpost,
  sigilSegmentsLeft,
  signpostBase,
  signpostBoard,
  signpostTopY,
  sigilOrigin,
  sigilPoint,
  slotChoices,
} from './plotView.js';

/**
 * Plots on the client (docs/design/holding.md "Plots", M2 Task 5): the plot
 * sentence panel's choices, lines and greyed states, "Next in …" from the
 * clock and the server's time, the cycle floats' prediction, the seal
 * scene's phases and the plots' world geometry.
 */
const T0 = Date.parse('2026-10-17T12:00:00.000Z');
const iso = (ms: number): string => new Date(T0 + ms).toISOString();
const adamah = wordDef('adamah') as WordDef;
const yashan = wordDef('yashan') as WordDef;
const layout = holdingLayout();
const plot1 = layout.plots[0] as LayoutPlot;
const unnamed = { ground: null, virtue: null, pieces: [] };
const named = { ground: 'adamah', virtue: null, pieces: [] };
const channel = { pieceId: 'clay-channel', col: 7, row: 7, rotation: 0 as const };

describe('the sentence', () => {
  it("shows the Ground's letters, the divider and the Virtue's; its sigil and its element follow the Ground", () => {
    expect(sentenceLetters('adamah', null)).toBe('אדמה');
    expect(sentenceLetters('adamah', 'yashan')).toBe('אדמה · ישן');
    expect(sentenceLetters(null, 'yashan')).toBe('');
    expect(sentenceLetters('shalom', null)).toBe('');
    expect(sentenceSigil('adamah', 'yashan').steps.map((s) => s.root)).toEqual([1, 4, 4, 5, 1, 3, 5]);
    expect(sentenceSigil(null, null)).toEqual({ steps: [], marks: [] });
    expect(groundElement('adamah')).toBe('earth');
    expect(groundElement(null)).toBe('earth');
    expect(sentenceStyle('adamah')).toBe('heavy-straight');
  });
});

describe('the plot sentence panel', () => {
  it('offers the known tiles that fit the slot (None first for the Virtue) with their letters, say, meaning and effect', () => {
    expect(slotChoices('ground', [])).toEqual([]);
    expect(slotChoices('ground', ['adamah'])).toEqual([{ wordId: 'adamah', letters: 'אדמה', label: 'adamah · tilled ground', effect: 'Builds: Field' }]);
    expect(slotChoices('virtue', ['adamah'])).toEqual([{ wordId: null, letters: '', label: 'None', effect: null }]);
    expect(slotChoices('virtue', ['adamah', 'yashan'])).toEqual([
      { wordId: null, letters: '', label: 'None', effect: null },
      { wordId: 'yashan', letters: 'ישן', label: 'yashan · old', effect: '+1% yield for each day it keeps its name, up to +20%' },
    ]);
    expect(effectLine(adamah)).toBe('Builds: Field');
    expect(effectLine(yashan)).toBe(PLOT_TEXT.YIELD_PER_DAY_EFFECT);
    expect(noWordsLine('ground')).toBe("You don't know any Ground words yet.");
    expect(noWordsLine('virtue')).toBe("You don't know any Virtue words yet.");
  });

  it('names or renames, costs nothing the first time and 1 sealed gin after, previews the Ground and the Virtue, and greys CONFIRM while unchanged or without a Ground', () => {
    const empty = plotPanelLines(unnamed, { ground: null, virtue: null });
    expect(empty).toEqual({
      title: 'Name this plot',
      renaming: false,
      cost: 'First naming: free',
      costTip: null,
      builds: null,
      effect: null,
      level: 'Level 1',
      pieces: 'Pieces: none yet',
      letters: '',
      confirmEnabled: false,
      previewTip: null,
    });
    // A Virtue alone has no Ground: still greyed.
    expect(plotPanelLines(unnamed, { ground: null, virtue: 'yashan' })).toMatchObject({ confirmEnabled: false, effect: PLOT_TEXT.YIELD_PER_DAY_EFFECT, builds: null });
    expect(plotPanelLines(unnamed, named)).toMatchObject({ builds: 'Builds: Field', letters: 'אדמה', confirmEnabled: true, previewTip: PLOT_TEXT.FIELD_TIP });
    // Renaming: the cost and its tooltip; the same sentence is greyed; a change is not.
    expect(plotPanelLines(named, named)).toMatchObject({ title: 'Rename this plot', renaming: true, cost: 'Renaming: 1 sealed gin', costTip: 'A name is paid for.', confirmEnabled: false });
    expect(plotPanelLines(named, { ground: 'adamah', virtue: 'yashan' })).toMatchObject({
      confirmEnabled: true,
      letters: 'אדמה · ישן',
      effect: PLOT_TEXT.YIELD_PER_DAY_EFFECT,
      previewTip: PLOT_TEXT.FIELD_TIP_VIRTUE,
    });
    expect(plotPanelLines({ ground: 'adamah', virtue: 'yashan', pieces: [] }, named)).toMatchObject({ confirmEnabled: true, effect: null });
    // The pieces standing (M2 Task 6): the level from them and their names, comma-separated.
    expect(plotPanelLines({ ...named, pieces: [channel, { ...channel, pieceId: 'seed-jars' }] }, named)).toMatchObject({ level: 'Level 3', pieces: 'Pieces: Clay channel, Seed jars' });
  });
});

describe('the cycles', () => {
  it('"Next in …" rounds up to the minute from the clock and the server time; the landed cycles are predicted from the clock', () => {
    const cycle = { cycleMs: 900_000, cycledUntil: iso(0), bonusPermille: 0 };
    expect(nextInLine(cycle, T0)).toBe('Next in 15 min');
    expect(nextInLine(cycle, T0 + 3 * 60_000)).toBe('Next in 12 min');
    expect(nextInLine(cycle, T0 + 14 * 60_000 + 30_000)).toBe('Next in 1 min');
    expect(nextInLine(cycle, T0 + 15 * 60_000)).toBe('Next in 15 min');
    expect(nextInLine({ cycleMs: 7_200_000, cycledUntil: iso(0) }, T0 + 60_000)).toBe('Next in 1 h 59 min');
    expect(nextInWords(0)).toBe('1 min');
    expect(nextInWords(59_999)).toBe('1 min');
    expect(nextInWords(60_000)).toBe('1 min');
    expect(nextInWords(60_001)).toBe('2 min');
    expect(cyclesLanded(cycle, T0 - 1)).toBe(0);
    expect(cyclesLanded(cycle, T0 + 899_999)).toBe(0);
    expect(cyclesLanded(cycle, T0 + 900_000)).toBe(1);
    expect(cyclesLanded(cycle, T0 + 3 * 900_000 + 1)).toBe(3);
    expect(cyclesLanded({ cycleMs: 900_000, cycledUntil: 'soon' }, T0)).toBe(0);
  });

  it("rates: the field's and the trees' (one log at a time, six trees); the bonus line from the permille, none at 0", () => {
    expect(cycleRateLine({ itemId: 'pale-grain', quantity: 1, cycleMs: 900_000 })).toBe('1 pale grain every 15 min');
    expect(cycleRateLine({ itemId: 'twisted-log', quantity: 1, cycleMs: 1_200_000 })).toBe('1 twisted log every 20 min');
    expect(cycleRateLine({ itemId: 'pale-grain', quantity: 2, cycleMs: 8_000 })).toBe('2 pale grain every 8 s');
    expect(bonusLine(0)).toBeNull();
    expect(bonusLine(30)).toBe('+3% for keeping its name');
    expect(bonusLine(200)).toBe('+20% for keeping its name');
    expect(bonusLine(5)).toBeNull();
  });
});

describe('the seal scene', () => {
  const t = defaultTuning.plots;

  it('runs the ring, then each letter, then the sigil, then the ground, about a second in all (tuning.json plots)', () => {
    expect(t).toEqual({ sealRingMs: 300, sealLetterMs: 70, sealSigilMs: 400, sealGroundMs: 200, buildMs: 400 });
    expect(sealDurationMs(t, 4)).toBe(300 + 280 + 400 + 200);
    expect(sealPhase(t, 0, 4, 4)).toEqual({ ring: 0, letters: 0, sigil: 0, ground: 0, done: false });
    expect(sealPhase(t, 150, 4, 4)).toMatchObject({ ring: 0.5, letters: 0, sigil: 0 });
    expect(sealPhase(t, 300, 4, 4)).toMatchObject({ ring: 1, letters: 0 });
    expect(sealPhase(t, 300 + 140, 4, 4)).toMatchObject({ ring: 1, letters: 2, sigil: 0 });
    expect(sealPhase(t, 300 + 280 + 200, 4, 4)).toMatchObject({ letters: 4, sigil: 1.5, ground: 0 });
    expect(sealPhase(t, 300 + 280 + 400, 4, 4)).toMatchObject({ sigil: 3, ground: 0 });
    expect(sealPhase(t, 300 + 280 + 400 + 100, 4, 4)).toMatchObject({ sigil: 3, ground: 0.5, done: false });
    expect(sealPhase(t, 300 + 280 + 400 + 200, 4, 4)).toMatchObject({ ground: 1, done: true });
    expect(sealPhase(t, 5000, 4, 4)).toMatchObject({ ring: 1, letters: 4, sigil: 3, ground: 1, done: true });
    // A one-letter sentence has no segment to trace.
    expect(sealPhase(t, 5000, 1, 1).sigil).toBe(0);
  });
});

describe('the plots in the world', () => {
  it('places the rectangle, the ring, the letters band, the sigil grid and the signpost in world px (2 per sim px)', () => {
    expect(plotWorldRect(plot1)).toEqual({ x: 7 * 32, y: 7 * 32, w: 192, h: 192 });
    expect(ringRect(plot1)).toEqual({ x: 7 * 32 + 4, y: 7 * 32 + 4, w: 184, h: 184 });
    const ring = ringPixels({ x: 0, y: 0, w: 4, h: 3 }, 1);
    expect(ring).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 2],
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ]);
    expect(ringPixels({ x: 0, y: 0, w: 4, h: 4 }, 2)).toHaveLength(12 + 4);
    expect(lettersBand(plot1, 30)).toEqual({ x: 7 * 32 + 4 + 92 - 30, y: 7 * 32 + 4 + 2 + 2 });
    // The signpost carries the sigil on its board (LORE 2026-10-18): a 30 px board on an 18 px post, the grid inset 3.
    expect(signpostBase(plot1)).toEqual({ x: 9.5 * 32, y: 10 * 32 });
    expect(signpostBoard(plot1)).toEqual({ x: 9.5 * 32 - 15, y: 10 * 32 - 18 - 30, w: 30, h: 30 });
    const origin = sigilOrigin(plot1);
    expect(origin).toEqual({ x: 9.5 * 32 - 12, y: 10 * 32 - 45 });
    expect(sigilPoint(origin, { row: 0, col: 0 })).toEqual({ x: origin.x + 4, y: origin.y + 4 });
    expect(sigilPoint(origin, { row: 2, col: 1 })).toEqual({ x: origin.x + 8 + 4, y: origin.y + 16 + 4 });
    expect(onSignpost(plot1, 9.5 * 32, 10 * 32 - 30)).toBe(true);
    expect(onSignpost(plot1, 9.5 * 32, 10 * 32 - 5)).toBe(true);
    expect(onSignpost(plot1, 9.5 * 32 + 10, 10 * 32 - 5)).toBe(false);
    expect(signpostTopY(plot1)).toBe(10 * 32 - 48);
    // It loses the line segment by segment while the plot's line is dark, all of it once faded.
    const line = (state: 'lit' | 'dark' | 'faded') => ({ state, fadesAt: 1000 });
    expect(sigilSegmentsLeft(4, line('lit'), null, 500)).toBe(4);
    expect(sigilSegmentsLeft(4, undefined, null, 500)).toBe(4);
    expect(sigilSegmentsLeft(4, line('dark'), 0, 0)).toBe(4);
    expect(sigilSegmentsLeft(4, line('dark'), 0, 1)).toBe(4);
    expect(sigilSegmentsLeft(4, line('dark'), 0, 500)).toBe(2);
    expect(sigilSegmentsLeft(4, line('dark'), 0, 999)).toBe(1);
    expect(sigilSegmentsLeft(4, line('faded'), 0, 1000)).toBe(0);
    expect(plotAtWorld(7 * 32 + 10, 7 * 32 + 10)?.id).toBe('plot-1');
    expect(plotAtWorld(0, 0)).toBeUndefined();
    expect(namedPlotIds({ plots: [{ id: 'plot-1', ground: 'adamah', virtue: null, namedAt: iso(0), virtueSetAt: null, sownAt: null, kind: 'field', pieces: [], level: 1, state: 'lit' }] })).toEqual(['plot-1']);
    expect(namedPlotIds(null)).toEqual([]);
  });
});
