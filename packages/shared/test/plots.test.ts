import { describe, expect, it } from 'vitest';
import {
  creditCycles,
  cycleBonuses,
  cycleLengthMs,
  cycleSpeedPermille,
  DAY_MS,
  DRAWABLE_CHARS,
  nextCycleInMs,
  PLOT_SENTENCE_STRICT,
  PLOT_TEXT,
  plotLevel,
  plotLine,
  plotSentence,
  plotSentenceSafe,
  plotTextLines,
  RENAME_COST_GIN,
  RENAME_COST_ITEM,
  wordDef,
  WORDS,
  wordsInSlot,
  yieldBonusPermille,
  type WordDef,
} from '../src/index.js';
import { BANNED } from './banned.js';

/**
 * Plots and plot sentences (docs/design/holding.md "Plots", M2 Task 5): every
 * Ground × Virtue sentence through the plot-sentence filter with the refused
 * pairs pinned, every player-facing line drawable, the plots' Writ line,
 * ישן's bonus at 0, 1, 19, 20 and 30 days and the carry across many cycles
 * adding up exactly, and Task 6's seams.
 */
const adamah = wordDef('adamah') as WordDef;
const yashan = wordDef('yashan') as WordDef;
const effect = yashan.effect;
if (!effect) throw new Error('ישן has no effect');
const T0 = Date.parse('2026-10-17T12:00:00Z');
const MIN = 15 * 60_000;

describe('the plot-sentence filter', () => {
  it('is strict today (the conservative reading of CLAUDE.md; LORE has been asked)', () => {
    expect(PLOT_SENTENCE_STRICT).toBe(true);
  });

  it('enumerates every Ground × Virtue pair in words.json and pins which the filter refuses: אדמה · ישן (he against yod across the space)', () => {
    const refused: string[] = [];
    const accepted: string[] = [];
    for (const ground of wordsInSlot('ground')) {
      // A Ground alone always passes: its letters pass the filter on their own.
      expect(plotSentenceSafe(plotSentence(ground, null)), ground.id).toEqual({ ok: true });
      for (const virtue of wordsInSlot('virtue')) {
        const sentence = plotSentence(ground, virtue);
        const r = plotSentenceSafe(sentence);
        (r.ok ? accepted : refused).push(`${ground.id} ${virtue.id}${r.ok ? '' : ` (${r.reason ?? ''})`}`);
      }
    }
    // The pinned pairs. LORE's answer on the mode flips PLOT_SENTENCE_STRICT and this list.
    expect(refused).toEqual(['adamah yashan (yod-he)']);
    expect(accepted).toEqual([]);
    // Under the non-strict rule the same sentence passes: the filter alone decides.
    expect(plotSentence(adamah, yashan)).toBe('אדמה ישן');
    expect(WORDS).toHaveLength(2);
  });
});

describe('the plots and their Writ line', () => {
  it('belong to line 1 in order, linePlots per line', () => {
    expect([0, 1, 2, 3].map((i) => plotLine(i))).toEqual([1, 1, 1, 1]);
    expect(plotLine(4)).toBe(2);
    expect(plotLine(7)).toBe(2);
    expect(plotLine(8)).toBe(3);
    expect(plotLine(2, 2)).toBe(2);
  });

  it("Task 6's seams: the speed factor is 1, a cycle's length is its cycleMs, a plot's level 1 without pieces", () => {
    expect(cycleSpeedPermille()).toBe(1000);
    expect(cycleSpeedPermille(3)).toBe(1000);
    expect(cycleLengthMs({ cycleMs: 900_000 })).toBe(900_000);
    expect(cycleLengthMs({ cycleMs: 900_000 }, 2)).toBe(900_000);
    expect(plotLevel()).toBe(1);
    expect(plotLevel(2)).toBe(3);
    expect(RENAME_COST_GIN).toBe(1);
    expect(RENAME_COST_ITEM).toBe('sealed-gin');
  });

  it('"Next in …": from the clock\'s stand to the next cycle, never negative', () => {
    expect(nextCycleInMs(T0, MIN, T0)).toBe(MIN);
    expect(nextCycleInMs(T0, MIN, T0 + 3 * 60_000)).toBe(12 * 60_000);
    expect(nextCycleInMs(T0, MIN, T0 + MIN)).toBe(MIN);
    expect(nextCycleInMs(T0, MIN, T0 + MIN + 1)).toBe(MIN - 1);
    expect(nextCycleInMs(T0 + 1000, MIN, T0)).toBe(MIN);
  });
});

describe("ישן's yield", () => {
  it('is +1% for every whole day the plot has kept its Virtue, up to +20%: 0, 1, 19, 20 and 30 days', () => {
    expect(yieldBonusPermille(effect, T0, T0)).toBe(0);
    expect(yieldBonusPermille(effect, T0, T0 + DAY_MS - 1)).toBe(0);
    expect(yieldBonusPermille(effect, T0, T0 + DAY_MS)).toBe(10);
    expect(yieldBonusPermille(effect, T0, T0 + 19 * DAY_MS)).toBe(190);
    expect(yieldBonusPermille(effect, T0, T0 + 20 * DAY_MS)).toBe(200);
    expect(yieldBonusPermille(effect, T0, T0 + 30 * DAY_MS)).toBe(200);
    // No Virtue, before it was set, or an unknown effect: nothing.
    expect(yieldBonusPermille(null, T0, T0 + 30 * DAY_MS)).toBe(0);
    expect(yieldBonusPermille(effect, null, T0 + 30 * DAY_MS)).toBe(0);
    expect(yieldBonusPermille(effect, T0 + DAY_MS, T0)).toBe(0);
  });

  it('each cycle takes the bonus at its own end, and the count restarts from virtue_set_at', () => {
    // Four 15 min cycles from 45 min before the Virtue's first day ends: the two ending before the day at 0, the two from it on at +1%.
    expect(cycleBonuses(4, T0 + DAY_MS - 3 * MIN, MIN, effect, T0)).toEqual([0, 0, 10, 10]);
    expect(cycleBonuses(2, T0, MIN, null, T0)).toEqual([0, 0]);
    expect(cycleBonuses(0, T0, MIN, effect, T0)).toEqual([]);
  });

  it('credits floor((carry + Σ quantity × (1000 + bonus)) / 1000) and carries the rest, adding up exactly over many cycles', () => {
    expect(creditCycles(1, 0, [0, 0, 0])).toEqual({ credited: 3, carry: 0 });
    expect(creditCycles(1, 0, [30])).toEqual({ credited: 1, carry: 30 });
    expect(creditCycles(1, 970, [30])).toEqual({ credited: 2, carry: 0 });
    expect(creditCycles(2, 0, [200, 200])).toEqual({ credited: 4, carry: 800 });
    // 192 cycles (48 h) at +3%: 192 × 1030 = 197,760 permille, 197 grain and 760 carried; one cycle at a time or all at once.
    const bonuses = Array.from({ length: 192 }, () => 30);
    expect(creditCycles(1, 0, bonuses)).toEqual({ credited: 197, carry: 760 });
    let carry = 0;
    let credited = 0;
    for (const b of bonuses) {
      const r = creditCycles(1, carry, [b]);
      credited += r.credited;
      carry = r.carry;
    }
    expect([credited, carry]).toEqual([197, 760]);
    // A thousand cycles at +20%: exactly 1200 grain, nothing lost.
    expect(creditCycles(1, 0, Array.from({ length: 1000 }, () => 200))).toEqual({ credited: 1200, carry: 0 });
  });
});

describe('the plots\' lines', () => {
  it('every player-facing line uses only characters the fonts can draw, and no banned name', () => {
    for (const line of plotTextLines()) {
      expect(Array.from(line).filter((ch) => !DRAWABLE_CHARS.has(ch)), line).toEqual([]);
      expect(BANNED.test(line), line).toBe(false);
    }
    expect(PLOT_TEXT.NEXT_IN('12 min')).toBe('Next in 12 min');
    expect(PLOT_TEXT.BONUS_LINE(3)).toBe('+3% for keeping its name');
    expect(PLOT_TEXT.FADED_PANEL(1)).toBe('Faded into the haze with line 1. Feed your Writ to bring it back.');
    // LORE's lines, word for word.
    expect(PLOT_TEXT.UNNAMED_PLOT_TIP).toBe('Ground, but not yet ground for anything. Give it a word.');
    expect(PLOT_TEXT.NO_VIRTUE_WORDS).toBe("You don't know any Virtue words yet.");
    expect(PLOT_TEXT.NO_GROUND).toBe('A Ground tile decides the building; without a Ground the plot cannot be built on');
  });
});
