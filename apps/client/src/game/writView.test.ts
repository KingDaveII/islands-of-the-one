import { HOUR_MS, pressedWrit, toWritView, WRIT_FULL, WRIT_TOO_MUCH_EVER, WRIT_TOO_MUCH_NOW, writData, type InventoryResponse, type WritView } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  chargeLines,
  COUNT_SIGN,
  derive,
  feedButtonLabel,
  fullTip,
  EMET,
  faceStates,
  feedChoices,
  feedLine,
  fillEnabled,
  flareDone,
  flareStates,
  flickerBeat,
  heldLine,
  hudName,
  lettersOf,
  lineLine,
  MET,
  NAME_BODY,
  NAME_TITLE,
  overLine,
  previewFeed,
  previewFill,
  relightDone,
  relightProgress,
  rimLine,
  stateLine,
  TABLET_TIP,
  tabletLetters,
  tabletStates,
  takesCount,
  writChip,
} from './writView.js';

/**
 * The Writ on the client (docs/design/holding.md "The Writ"): the panel's
 * state lines, the letter states per Writ state (the flicker beat, the
 * relight), the feed choices and previews, the Name screen's tablet and the
 * HUD's chip.
 */
const T0 = Date.parse('2026-10-17T12:00:00.000Z');
const at = (h: number): number => T0 + h * HOUR_MS;
const H = HOUR_MS;

const named = (emptyAt: number, now: number, certified = false): WritView =>
  toWritView({ name: 'Black Rock', letters: 'בלק רוק', certified, emptyAt, lineCount: 1 }, now);

const inventory: InventoryResponse = {
  purse: [{ itemId: 'sealed-gin', quantity: 5 }],
  pack: [{ itemId: 'wild-sliver', quantity: 2 }],
  store: [
    { itemId: 'wild-sliver', quantity: 1 },
    { itemId: 'glass-chip', quantity: 1 },
  ],
  baskets: {},
};

describe('the Name screen', () => {
  it("quotes LORE's lines and hears the Name live", () => {
    expect(NAME_TITLE).toBe('Name your island.');
    expect(NAME_BODY).toBe(
      'Whatever you write here will be cut into your Writ in the Old Letters, and the Hollow will know this rock by it.',
    );
    expect(TABLET_TIP).toBe("Cut as it sounds, not as it's spelled. The Writ only has to hear it.");
    expect(tabletLetters('Black Rock')).toBe('בלק רוק');
    expect(tabletLetters('')).toBe('');
    expect(EMET).toHaveLength(3);
  });

  it('keeps the letters already cut lit and makes the new ones ember', () => {
    expect(tabletStates('', tabletLetters('B'))).toEqual(['ember', 'ember']); // the lone letter gets its aleph
    expect(tabletStates(tabletLetters('Bla'), tabletLetters('Blac'))).toEqual(['lit', 'lit', 'ember']);
    expect(tabletStates(tabletLetters('Black'), tabletLetters('Black R'))).toEqual(['lit', 'lit', 'lit', 'ember']);
    // A door closing changes an earlier letter: from there on it is new.
    expect(tabletStates(tabletLetters('May'), tabletLetters('Maya'))).toEqual(['lit', 'lit', 'ember']);
    expect(tabletStates('x', '')).toEqual([]);
  });

  it('flares each accepted letter ember in turn, then settles lit', () => {
    expect(flareStates(3, 0)).toEqual(['ember', 'lit', 'lit']);
    expect(flareStates(3, 100)).toEqual(['ember', 'ember', 'lit']);
    expect(flareStates(3, 220)).toEqual(['lit', 'ember', 'ember']);
    expect(flareStates(3, 1000)).toEqual(['lit', 'lit', 'lit']);
    expect(flareDone(3, 349)).toBe(false);
    expect(flareDone(3, 350)).toBe(true);
    expect(flareDone(0, 0)).toBe(false);
    expect(flareDone(0, 210)).toBe(true);
  });
});

describe('the face', () => {
  const lit = derive(named(at(100), at(0)), at(0));
  const flickering = derive(named(at(10), at(0)), at(0));
  const dark = derive(named(at(0), at(10)), at(10));
  const fading = derive(named(at(0), at(100)), at(100));
  const letters = 'בלק רוק';

  it('lit: every letter lit', () => {
    // 100 h is full (not even a sliver fits): every letter clear gold, steady (ART's gold state); 50 h is plainly lit.
    expect(lit.full).toBe(true);
    expect(faceStates(lit, letters, false)).toEqual({ emet: ['gold', 'gold', 'gold'], name: Array<string>(6).fill('gold') });
    expect(faceStates(lit, letters, true)).toEqual({ emet: ['gold', 'gold', 'gold'], name: Array<string>(6).fill('gold') });
    const notFull = derive(named(at(50), at(0)), at(0));
    expect(notFull.full).toBe(false);
    expect(faceStates(notFull, letters, false)).toEqual({ emet: ['lit', 'lit', 'lit'], name: Array<string>(6).fill('lit') });
  });

  it('flickering: ember, the outer letters of each line switching between ember and dim on the beat', () => {
    expect(faceStates(flickering, letters, false)).toEqual({ emet: ['ember', 'ember', 'ember'], name: Array<string>(6).fill('ember') });
    expect(faceStates(flickering, letters, true)).toEqual({
      emet: ['dim', 'ember', 'dim'],
      name: ['dim', 'ember', 'ember', 'ember', 'ember', 'dim'],
    });
    // writ.json's flickerPatternMs (ART on #91): lit 600, dim 140, lit 260, dim 140, repeating every 1140 ms.
    expect(writData.flickerPatternMs).toEqual([600, 140, 260, 140]);
    expect([0, 599, 600, 739, 740, 999, 1000, 1139, 1140, 1740].map((ms) => flickerBeat(ms))).toEqual([
      false,
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      true,
    ]);
    expect(flickerBeat(5, [10, 10])).toBe(false);
    expect(flickerBeat(15, [10, 10])).toBe(true);
  });

  it('dark: the aleph dark so the Writ reads מת, the Name dim; fading: the Name dark once line 1 faded', () => {
    expect(faceStates(dark, letters, true)).toEqual({ emet: ['dark', 'lit', 'lit'], name: Array<string>(6).fill('dim') });
    expect(faceStates(fading, letters, false)).toEqual({ emet: ['dark', 'lit', 'lit'], name: Array<string>(6).fill('dark') });
    expect(lettersOf(MET)).toEqual(lettersOf(EMET).slice(1));
  });

  it('relights the aleph first, then each line one after another', () => {
    expect(relightProgress(0, 1)).toEqual({ aleph: false, lines: 0 });
    expect(relightProgress(399, 1)).toEqual({ aleph: false, lines: 0 });
    expect(relightProgress(400, 1)).toEqual({ aleph: true, lines: 0 });
    expect(relightProgress(1300, 1)).toEqual({ aleph: true, lines: 1 });
    expect(relightProgress(5000, 2)).toEqual({ aleph: true, lines: 2 });
    expect(relightDone(1299, 1)).toBe(false);
    expect(relightDone(1300, 1)).toBe(true);
    expect(faceStates(lit, letters, false, { aleph: false, lines: 0 })).toEqual({ emet: ['dark', 'lit', 'lit'], name: Array<string>(6).fill('dim') });
    expect(faceStates(lit, letters, false, { aleph: true, lines: 0 })).toEqual({ emet: ['lit', 'lit', 'lit'], name: Array<string>(6).fill('dim') });
    expect(faceStates(lit, letters, false, { aleph: true, lines: 1 })).toEqual({ emet: ['lit', 'lit', 'lit'], name: Array<string>(6).fill('lit') });
  });
});

describe("the panel's lines", () => {
  it('the rim, the charge, the state line and the lines', () => {
    expect(rimLine(false)).toBe('not certified: the Wet House in Malkhut');
    expect(rimLine(true)).toBe('certified');
    const lit = derive(named(at(41) + 12 * 60_000, at(0)), at(0));
    expect(chargeLines(lit)).toEqual({ words: 'about two days', exact: '41 h 12 min' });
    expect(chargeLines(derive(named(at(10), at(0)), at(0)))).toEqual({ words: 'less than a day', exact: '10 h 0 min' });
    // Dark or fading: the charge is 0 and the state line says so, so the charge line is left out (MAIN, #91).
    expect(chargeLines(derive(named(at(0), at(10)), at(10)))).toBeNull();
    expect(chargeLines(derive(named(at(0), at(100)), at(100)))).toBeNull();
    expect(stateLine(lit, at(0))).toBe('Lit');
    expect(stateLine(derive(named(at(10), at(0)), at(0)), at(0))).toBe('Flickering');
    const dark = derive(named(at(0), at(3) + 12 * 60_000), at(3) + 12 * 60_000);
    expect(stateLine(dark, at(3) + 12 * 60_000)).toBe('Dark since 3 h 12 min, grace ends in 44 h 48 min');
    expect(stateLine(derive(named(at(0), at(100)), at(100)), at(100))).toBe('Line 1 fading');
    expect(lineLine({ line: 1, plots: 4, state: 'lit', fadesAt: 0 })).toBe('Line 1, the Name: tethers 4 plots · lit');
    expect(lineLine({ line: 1, plots: 4, state: 'faded', fadesAt: 0 })).toBe('Line 1, the Name: tethers 4 plots · faded');
    expect(lineLine({ line: 2, plots: 4, state: 'lit', fadesAt: 0 })).toBe('Line 2: tethers 4 plots · lit');
    // Full: the words say so, and the greyed button's tooltip says when a sliver fits again.
    const full = derive(named(at(100), at(0)), at(0));
    expect(chargeLines(full)).toEqual({ words: 'about four days, full', exact: '100 h 0 min' });
    expect(fullTip(full)).toBe('A sliver fits in about 4 h');
    expect(fullTip(derive(named(at(96) + 1, at(0)), at(0)))).toBe('A sliver fits in about 1 h');
    expect(fullTip(derive(named(at(144), at(0)), at(0)))).toBe('A sliver fits in about 48 h');
    expect(chargeLines(derive(named(at(96), at(0)), at(0)))).toEqual({ words: 'about four days', exact: '96 h 0 min' });
    // The gin button carries the count; glass feeds one.
    expect(feedButtonLabel('sealed-gin', 3)).toBe('FEED 3');
    expect(feedButtonLabel('sealed-gin')).toBe('FEED 1');
    expect(feedButtonLabel('wild-sliver', 3)).toBe('FEED ONE');
    expect(COUNT_SIGN).toBe('\u00d7');
  });

  it('the feed choices: every kind with its counts, greyed with the line when it does not fit', () => {
    // 100 h of charge: a sliver doesn't fit (148), so the Writ is full; a humming glass never fits with charge; deep glass never.
    const full = feedChoices(named(at(100), at(0)), inventory, at(0));
    expect(full.map((c) => [c.itemId, c.name, c.have, c.refusal, c.enabled])).toEqual([
      ['wild-sliver', 'Wild slivers', 3, WRIT_FULL, false],
      ['sealed-gin', 'Sealed gin', 5, WRIT_FULL, false],
      ['glass-chip', 'Humming glass', 1, WRIT_FULL, false],
      ['deep-glass', 'Deep glass', 0, WRIT_TOO_MUCH_EVER, false],
    ]);
    // 10 h: slivers and gin fit, humming glass is too much now, deep glass too much ever.
    const low = feedChoices(named(at(10), at(0)), inventory, at(0));
    expect(low.map((c) => [c.itemId, c.refusal, c.enabled])).toEqual([
      ['wild-sliver', null, true],
      ['sealed-gin', null, true],
      ['glass-chip', WRIT_TOO_MUCH_NOW, false],
      ['deep-glass', WRIT_TOO_MUCH_EVER, false],
    ]);
    // Dark: a humming glass fits; nothing held of deep glass.
    const dark = feedChoices(named(at(0), at(10)), inventory, at(10));
    expect(dark.map((c) => [c.itemId, c.refusal, c.enabled])).toEqual([
      ['wild-sliver', null, true],
      ['sealed-gin', null, true],
      ['glass-chip', null, true],
      ['deep-glass', WRIT_TOO_MUCH_EVER, false],
    ]);
    expect(feedChoices(named(at(0), at(10)), null, at(10)).every((c) => !c.enabled && c.have === 0)).toBe(true);
    expect(heldLine(low[0] as (typeof low)[number])).toBe('2 in the pack, 1 in the store');
    expect(heldLine(low[1] as (typeof low)[number])).toBe('5 in the purse');
    expect(heldLine(low[2] as (typeof low)[number])).toBe('1 in the store');
    expect(heldLine(low[3] as (typeof low)[number])).toBe('none');
    expect(takesCount('sealed-gin')).toBe(true);
    expect(takesCount('wild-sliver')).toBe(false);
  });

  it('the previews: the charge a feed gives, Fill for slivers only, the button disabled on a full Writ', () => {
    const low = named(at(10), at(0));
    expect(feedLine(previewFeed(low, 'wild-sliver', 1, at(0)))).toBe('+1/3 charge, about two days');
    expect(feedLine(previewFeed(low, 'sealed-gin', 2, at(0)))).toBe('+2/3 charge, about four days');
    expect(feedLine(previewFeed(low, 'glass-chip', 1, at(0)))).toBe(WRIT_TOO_MUCH_NOW);
    expect(feedLine(previewFill(low, at(0)))).toBe('+2/3 charge, about four days');
    expect(fillEnabled(low, feedChoices(low, inventory, at(0)), at(0))).toBe(true);
    expect(fillEnabled(low, feedChoices(low, { ...inventory, pack: [], store: [] }, at(0)), at(0))).toBe(false);
    const full = named(at(100), at(0));
    expect(feedLine(previewFill(full, at(0)))).toBe(WRIT_FULL);
    expect(fillEnabled(full, feedChoices(full, inventory, at(0)), at(0))).toBe(false);
    expect(feedLine(previewFeed(full, 'wild-sliver', 1, at(0)))).toBe('Full.');
  });
});

describe('the HUD', () => {
  it('the chip: the words, ember under a day, מת when dark or fading, the exact time as its tooltip', () => {
    expect(writChip(derive(named(at(100), at(0)), at(0)))).toEqual({ text: 'about four days', letters: null, ember: false, gold: true, tooltip: '100 h 0 min', state: 'lit' });
    expect(writChip(derive(named(at(10), at(0)), at(0)))).toEqual({ text: 'less than a day', letters: null, ember: true, gold: false, tooltip: '10 h 0 min', state: 'flickering' });
    expect(writChip(derive(named(at(0), at(10)), at(10)))).toEqual({ text: null, letters: MET, ember: false, gold: false, tooltip: '0 min', state: 'dark' });
    expect(writChip(derive(named(at(0), at(100)), at(100)))).toMatchObject({ text: null, letters: MET, state: 'fading' });
    expect(writChip(derive(toWritView(pressedWrit(at(0)), at(0)), at(0)))).toMatchObject({ text: 'about two days', ember: false });
  });

  it('the Name as typed and its letters, none before the island is named', () => {
    expect(hudName(named(at(100), at(0)))).toEqual({ typed: 'Black Rock', letters: 'בלק רוק' });
    expect(hudName(toWritView(pressedWrit(at(0)), at(0)))).toBeNull();
    expect(overLine('בלק רוק')).toBe(false);
    expect(overLine(tabletLetters('The Last Light of Evening'))).toBe(true);
  });

  it('re-derives between heartbeats at the estimated server clock', () => {
    const view = named(at(30), at(0));
    expect(derive(view, at(0)).state).toBe('lit');
    expect(derive(view, at(20)).state).toBe('flickering');
    expect(derive(view, at(30)).state).toBe('dark');
    expect(derive(view, at(30)).chargeMs).toBe(0);
    expect(derive(view, at(0)).chargeMs).toBe(30 * H);
  });
});
