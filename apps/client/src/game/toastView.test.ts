import { HOUR_MS, pressedWrit, TOAST_MAX, TOAST_MS, TOAST_TEXT, toWritView, type HoldingResponse, type WritView } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  defaultToastStorage,
  levelUps,
  packFullToast,
  skillItem,
  skillLevelToast,
  storeFullToast,
  ToastQueue,
  toastGlyph,
  WritToastMemory,
  writToastKey,
  writToastsDue,
  type ToastStorage,
} from './toastView.js';

/**
 * The toasts' logic (docs/design/holding.md "Sleep, the away card and
 * toasts", M2 Task 7): the queue (hold, drop in one frame, push up, two at
 * most, the same text restarting), each trigger (the skill level never on a
 * session's first answer, the Writ low and dark, the full store, the full
 * pack) and the Writ-low memory with and without storage.
 */
const T0 = Date.parse('2026-10-17T12:00:00.000Z');

function answer(levels: Partial<Record<'woodcutting' | 'mining' | 'farming', number>>): HoldingResponse {
  const skill = (level: number) => ({ xp: 0, level, into: 0, toNext: 40 });
  return {
    layoutId: 'first-holding',
    baskets: {},
    activity: null,
    now: new Date(T0).toISOString(),
    skills: { woodcutting: skill(levels.woodcutting ?? 1), mining: skill(levels.mining ?? 1), farming: skill(levels.farming ?? 1) },
    writ: toWritView(pressedWrit(T0), T0),
    kesh: { firstGiven: true, due: null, nextTideAt: new Date(T0).toISOString(), wordDue: false, seedsDue: false },
    words: [],
    plots: [],
    cycles: {},
    away: null,
  };
}

function writ(chargeMs: number, named = true): WritView {
  return toWritView({ ...pressedWrit(T0), emptyAt: T0 + chargeMs, name: named ? 'Rock' : null, letters: named ? 'רק' : null }, T0);
}

describe('the queue', () => {
  it('holds a toast toastMs then drops it in one frame', () => {
    const q = new ToastQueue();
    q.push('pack-full', 'Pack full.', { kind: 'square' });
    expect(q.lines()).toEqual(['Pack full.']);
    q.update(TOAST_MS - 1);
    expect(q.lines()).toEqual(['Pack full.']);
    q.update(1);
    expect(q.lines()).toEqual([]);
    expect(TOAST_MS).toBe(3000);
  });

  it('a new toast joins at the bottom, pushing the older up a line; a third drops the oldest at once', () => {
    const q = new ToastQueue();
    q.push('skill-level', 'Woodcutting 2.', { kind: 'item', itemId: 'twisted-log' });
    q.update(1000);
    q.push('store-full', 'Store: twisted logs full.', { kind: 'item', itemId: 'twisted-log' });
    expect(q.lines()).toEqual(['Woodcutting 2.', 'Store: twisted logs full.']);
    expect(q.toasts.map((t) => t.life)).toEqual([2000, 3000]);
    q.push('pack-full', 'Pack full.', { kind: 'square' });
    expect(q.lines()).toEqual(['Store: twisted logs full.', 'Pack full.']);
    expect(TOAST_MAX).toBe(2);
    // Each keeps its own hold: the older goes first.
    q.update(1000);
    q.push('writ-low', 'Your Writ has about a day left.', { kind: 'square' });
    expect(q.lines()).toEqual(['Pack full.', 'Your Writ has about a day left.']);
    q.update(2000);
    expect(q.lines()).toEqual(['Your Writ has about a day left.']);
    q.update(1000);
    expect(q.lines()).toEqual([]);
  });

  it('the same text restarts its hold instead of stacking', () => {
    const q = new ToastQueue();
    q.push('pack-full', 'Pack full.', { kind: 'square' });
    q.update(2500);
    q.push('pack-full', 'Pack full.', { kind: 'square' });
    expect(q.lines()).toEqual(['Pack full.']);
    expect(q.toasts[0]?.life).toBe(TOAST_MS);
    q.update(2999);
    expect(q.lines()).toEqual(['Pack full.']);
    q.update(1);
    expect(q.lines()).toEqual([]);
  });

  it('takes its hold and its depth from the data, or from the caller', () => {
    const q = new ToastQueue(100, 3);
    q.push('pack-full', 'a', { kind: 'square' });
    q.push('pack-full', 'b', { kind: 'square' });
    q.push('pack-full', 'c', { kind: 'square' });
    q.push('pack-full', 'd', { kind: 'square' });
    expect(q.lines()).toEqual(['b', 'c', 'd']);
    q.update(100);
    expect(q.lines()).toEqual([]);
    q.push('pack-full', 'e', { kind: 'square' });
    q.clear();
    expect(q.lines()).toEqual([]);
  });
});

describe('the glyphs', () => {
  it("each skill's item: a twisted log, black stone, pale grain", () => {
    expect(skillItem('woodcutting')).toBe('twisted-log');
    expect(skillItem('mining')).toBe('black-stone');
    expect(skillItem('farming')).toBe('pale-grain');
  });

  it("the item's icon for store-full and skill-level, the square for the rest", () => {
    expect(toastGlyph('store-full', 'twisted-log')).toEqual({ kind: 'item', itemId: 'twisted-log' });
    expect(toastGlyph('skill-level', 'pale-grain')).toEqual({ kind: 'item', itemId: 'pale-grain' });
    expect(toastGlyph('pack-full')).toEqual({ kind: 'square' });
    expect(toastGlyph('writ-low', 'twisted-log')).toEqual({ kind: 'square' });
    expect(toastGlyph('writ-dark')).toEqual({ kind: 'square' });
  });
});

describe('the triggers', () => {
  it('a skill level: higher than in the previous answer; never on the first answer of a session', () => {
    expect(levelUps(null, answer({ woodcutting: 9 }))).toEqual([]);
    expect(levelUps(answer({}), answer({}))).toEqual([]);
    expect(levelUps(answer({ woodcutting: 2 }), answer({ woodcutting: 3, farming: 2 }))).toEqual([
      { skill: 'woodcutting', level: 3 },
      { skill: 'farming', level: 2 },
    ]);
    // A level that fell (nothing does in M2) is no toast.
    expect(levelUps(answer({ mining: 4 }), answer({ mining: 3 }))).toEqual([]);
    expect(skillLevelToast('woodcutting', 2)).toEqual({ text: 'Woodcutting 2.', glyph: { kind: 'item', itemId: 'twisted-log' } });
  });

  it("store full: the take-all's left-overs, the item's own icon; nothing when all moved", () => {
    expect(storeFullToast({ stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 3 }], left: [] })).toBeNull();
    expect(storeFullToast({ stationId: 'twisted-trees', moved: [], left: [{ itemId: 'twisted-log', quantity: 4 }] })).toEqual({
      text: 'Store: twisted logs full.',
      glyph: { kind: 'item', itemId: 'twisted-log' },
    });
  });

  it('pack full: the one line, the square', () => {
    expect(packFullToast()).toEqual({ text: TOAST_TEXT.PACK_FULL, glyph: { kind: 'square' } });
  });

  it('the Writ: low while under a day with charge, dark once it has none, keyed by the drain; lit is neither', () => {
    expect(writToastsDue(writ(30 * HOUR_MS), T0)).toEqual({ low: false, dark: false, emptyAt: new Date(T0 + 30 * HOUR_MS).toISOString() });
    expect(writToastsDue(writ(20 * HOUR_MS), T0)).toMatchObject({ low: true, dark: false });
    // Read at the client's clock: the same Writ crosses under a day 6 h later.
    expect(writToastsDue(writ(30 * HOUR_MS), T0 + 7 * HOUR_MS)).toMatchObject({ low: true, dark: false });
    expect(writToastsDue(writ(-HOUR_MS), T0)).toMatchObject({ low: false, dark: true });
    expect(writToastsDue(writ(-50 * HOUR_MS), T0)).toMatchObject({ low: false, dark: true });
    expect(writToastsDue(writ(20 * HOUR_MS, false), T0)).toMatchObject({ low: true });
  });
});

describe('the Writ-low memory', () => {
  const fake = (): ToastStorage & { data: Record<string, string> } => {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => {
        data[k] = v;
      },
    };
  };

  it('remembers the drain each toast was shown for, per Kindled, under its key', () => {
    const storage = fake();
    const m = new WritToastMemory(storage);
    const drain = new Date(T0 + 20 * HOUR_MS).toISOString();
    expect(m.told('writLow', 'ash', drain)).toBe(false);
    m.mark('writLow', 'ash', drain);
    expect(m.told('writLow', 'ash', drain)).toBe(true);
    expect(storage.data).toEqual({ 'iot.toast.writLow.ash': drain });
    expect(writToastKey('writDark', 'ash')).toBe('iot.toast.writDark.ash');
    // Another Kindled, another kind, or a feed that moved the drain: not told.
    expect(m.told('writLow', 'tide', drain)).toBe(false);
    expect(m.told('writDark', 'ash', drain)).toBe(false);
    expect(m.told('writLow', 'ash', new Date(T0 + 68 * HOUR_MS).toISOString())).toBe(false);
  });

  it('without storage nothing is remembered (the toast may repeat), and a failing store is no error', () => {
    const none = new WritToastMemory(null);
    none.mark('writLow', 'ash', 'x');
    expect(none.told('writLow', 'ash', 'x')).toBe(false);
    const broken = new WritToastMemory({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => {
      broken.mark('writLow', 'ash', 'x');
    }).not.toThrow();
    expect(broken.told('writLow', 'ash', 'x')).toBe(false);
    // Node has no localStorage: the default is none.
    expect(defaultToastStorage()).toBeNull();
  });
});
