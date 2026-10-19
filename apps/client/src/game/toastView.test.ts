import {
  HOUR_MS,
  pressedWrit,
  TOAST_MAX,
  TOAST_MS,
  TOAST_TEXT,
  toWritView,
  type HoldingResponse,
  type WritView,
} from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  defaultToastStorage,
  LevelMemory,
  levelsKey,
  levelUps,
  packFullToast,
  skillLevels,
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
 * most, the same text restarting), each trigger (the skill level against
 * the levels remembered, never with a card or with nothing remembered, the
 * Writ low and dark, the full store, the full pack), GAME DESIGN's 20-minute
 * case, and the memories with and without storage.
 */
const T0 = Date.parse('2026-10-17T12:00:00.000Z');

function answer(
  levels: Partial<Record<'woodcutting' | 'mining' | 'farming', number>>,
  away: HoldingResponse['away'] = null,
): HoldingResponse {
  const skill = (level: number) => ({ xp: 0, level, into: 0, toNext: 40 });
  return {
    layoutId: 'first-holding',
    baskets: {},
    activity: null,
    now: new Date(T0).toISOString(),
    skills: {
      woodcutting: skill(levels.woodcutting ?? 1),
      mining: skill(levels.mining ?? 1),
      farming: skill(levels.farming ?? 1),
    },
    writ: toWritView(pressedWrit(T0), T0),
    kesh: {
      firstGiven: true,
      due: null,
      nextTideAt: new Date(T0).toISOString(),
      wordDue: false,
      seedsDue: false,
    },
    words: [],
    plots: [],
    cycles: {},
    away,
  };
}

const CARD: HoldingResponse['away'] = {
  from: new Date(T0 - 20 * 60_000).toISOString(),
  to: new Date(T0).toISOString(),
  made: {},
  levels: { woodcutting: { from: 2, to: 3 } },
};

const fakeStorage = (): ToastStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};

function writ(chargeMs: number, named = true): WritView {
  return toWritView(
    {
      ...pressedWrit(T0),
      emptyAt: T0 + chargeMs,
      name: named ? 'Rock' : null,
      letters: named ? 'רק' : null,
    },
    T0,
  );
}

describe('the queue', () => {
  it('holds a toast toastMs then drops it in one frame', () => {
    const q = new ToastQueue();
    q.push('pack-full', 'Pack full.', { name: 'pack-full' });
    expect(q.lines()).toEqual(['Pack full.']);
    q.update(TOAST_MS - 1);
    expect(q.lines()).toEqual(['Pack full.']);
    q.update(1);
    expect(q.lines()).toEqual([]);
    expect(TOAST_MS).toBe(3000);
  });

  it('a new toast joins at the bottom, pushing the older up a line; a third drops the oldest at once', () => {
    const q = new ToastQueue();
    q.push('skill-level', 'Woodcutting 2.', { name: 'skill-woodcutting' });
    q.update(1000);
    q.push('store-full', 'Store: twisted logs full.', { name: 'skill-woodcutting' });
    expect(q.lines()).toEqual(['Woodcutting 2.', 'Store: twisted logs full.']);
    expect(q.toasts.map((t) => t.life)).toEqual([2000, 3000]);
    q.push('pack-full', 'Pack full.', { name: 'pack-full' });
    expect(q.lines()).toEqual(['Store: twisted logs full.', 'Pack full.']);
    expect(TOAST_MAX).toBe(2);
    // Each keeps its own hold: the older goes first.
    q.update(1000);
    q.push('writ-low', 'Your Writ has about a day left.', { name: 'pack-full' });
    expect(q.lines()).toEqual(['Pack full.', 'Your Writ has about a day left.']);
    q.update(2000);
    expect(q.lines()).toEqual(['Your Writ has about a day left.']);
    q.update(1000);
    expect(q.lines()).toEqual([]);
  });

  it('the same text restarts its hold instead of stacking', () => {
    const q = new ToastQueue();
    q.push('pack-full', 'Pack full.', { name: 'pack-full' });
    q.update(2500);
    q.push('pack-full', 'Pack full.', { name: 'pack-full' });
    expect(q.lines()).toEqual(['Pack full.']);
    expect(q.toasts[0]?.life).toBe(TOAST_MS);
    q.update(2999);
    expect(q.lines()).toEqual(['Pack full.']);
    q.update(1);
    expect(q.lines()).toEqual([]);
  });

  it('takes its hold and its depth from the data, or from the caller', () => {
    const q = new ToastQueue(100, 3);
    q.push('pack-full', 'a', { name: 'pack-full' });
    q.push('pack-full', 'b', { name: 'pack-full' });
    q.push('pack-full', 'c', { name: 'pack-full' });
    q.push('pack-full', 'd', { name: 'pack-full' });
    expect(q.lines()).toEqual(['b', 'c', 'd']);
    q.update(100);
    expect(q.lines()).toEqual([]);
    q.push('pack-full', 'e', { name: 'pack-full' });
    q.clear();
    expect(q.lines()).toEqual([]);
  });
});

describe('the glyphs (ART, #109)', () => {
  it("a skill level names the skill's own cell, the other kinds their own; store full is the store's bin, never the item's icon", () => {
    expect(toastGlyph('skill-level', 'woodcutting')).toEqual({ name: 'skill-woodcutting' });
    expect(toastGlyph('skill-level', 'farming')).toEqual({ name: 'skill-farming' });
    expect(toastGlyph('store-full')).toEqual({ name: 'store-full' });
    expect(toastGlyph('pack-full')).toEqual({ name: 'pack-full' });
    expect(toastGlyph('writ-low')).toEqual({ name: 'writ-low' });
    expect(toastGlyph('writ-dark')).toEqual({ name: 'writ-dark' });
  });
});

describe('the triggers', () => {
  it('a skill level: above the last seen; nothing with nothing seen, or on an answer carrying the card', () => {
    expect(levelUps(null, answer({ woodcutting: 9 }))).toEqual([]);
    expect(levelUps(skillLevels(answer({})), answer({}))).toEqual([]);
    expect(
      levelUps(skillLevels(answer({ woodcutting: 2 })), answer({ woodcutting: 3, farming: 2 })),
    ).toEqual([
      { skill: 'woodcutting', level: 3 },
      { skill: 'farming', level: 2 },
    ]);
    // A level that fell (nothing does in M2) is no toast; a skill the memory lacks is none either.
    expect(levelUps(skillLevels(answer({ mining: 4 })), answer({ mining: 3 }))).toEqual([]);
    expect(levelUps({ mining: 1 }, answer({ woodcutting: 5, mining: 1 }))).toEqual([]);
    // The card says it.
    expect(
      levelUps(skillLevels(answer({ woodcutting: 2 })), answer({ woodcutting: 3 }, CARD)),
    ).toEqual([]);
    expect(skillLevelToast('woodcutting', 2)).toEqual({
      text: 'Woodcutting 2.',
      glyph: { name: 'skill-woodcutting' },
    });
    expect(skillLevels(answer({ mining: 4 }))).toEqual({ woodcutting: 1, mining: 4, farming: 1 });
  });

  it("GAME DESIGN's 20 minutes: closed across a level-up, reopened under 30 min, the level toast shows with no card", () => {
    // The last session's answers stored Woodcutting 2; the tab closed; the trees made Woodcutting 3 meanwhile.
    const storage = fakeStorage();
    const memory = new LevelMemory(storage);
    memory.write('ash', skillLevels(answer({ woodcutting: 2 })));
    expect(storage.data).toEqual({
      'iot.toast.levels.ash': '{"woodcutting":2,"mining":1,"farming":1}',
    });
    // Reopened 20 min later: the first answer carries no card and Woodcutting 3, so one toast.
    expect(levelUps(memory.read('ash'), answer({ woodcutting: 3 }))).toEqual([
      { skill: 'woodcutting', level: 3 },
    ]);
    // Reopened after 30 min or more: the answer carries the card, which says it, so none.
    expect(levelUps(memory.read('ash'), answer({ woodcutting: 3 }, CARD))).toEqual([]);
    // A new browser has nothing stored: none.
    expect(levelUps(memory.read('tide'), answer({ woodcutting: 3 }))).toEqual([]);
    expect(levelsKey('ash')).toBe('iot.toast.levels.ash');
  });

  it("store full: the take-all's left-overs, the item's own icon; nothing when all moved", () => {
    expect(
      storeFullToast({
        stationId: 'twisted-trees',
        moved: [{ itemId: 'twisted-log', quantity: 3 }],
        left: [],
      }),
    ).toBeNull();
    expect(
      storeFullToast({
        stationId: 'twisted-trees',
        moved: [],
        left: [{ itemId: 'twisted-log', quantity: 4 }],
      }),
    ).toEqual({
      text: 'Store: twisted logs full.',
      glyph: { name: 'store-full' },
    });
  });

  it('pack full: the one line, the square', () => {
    expect(packFullToast()).toEqual({ text: TOAST_TEXT.PACK_FULL, glyph: { name: 'pack-full' } });
  });

  it('the Writ: low while under a day with charge, dark once it has none, keyed by the drain; lit is neither', () => {
    expect(writToastsDue(writ(30 * HOUR_MS), T0)).toEqual({
      low: false,
      dark: false,
      emptyAt: new Date(T0 + 30 * HOUR_MS).toISOString(),
    });
    expect(writToastsDue(writ(20 * HOUR_MS), T0)).toMatchObject({ low: true, dark: false });
    // Read at the client's clock: the same Writ crosses under a day 6 h later.
    expect(writToastsDue(writ(30 * HOUR_MS), T0 + 7 * HOUR_MS)).toMatchObject({
      low: true,
      dark: false,
    });
    expect(writToastsDue(writ(-HOUR_MS), T0)).toMatchObject({ low: false, dark: true });
    expect(writToastsDue(writ(-50 * HOUR_MS), T0)).toMatchObject({ low: false, dark: true });
    expect(writToastsDue(writ(20 * HOUR_MS, false), T0)).toMatchObject({ low: true });
  });
});

describe('the levels memory', () => {
  it('reads what it wrote, per account; a malformed or partial record reads as what it can', () => {
    const storage = fakeStorage();
    const m = new LevelMemory(storage);
    expect(m.read('ash')).toBeNull();
    m.write('ash', { woodcutting: 7, mining: 2, farming: 4 });
    expect(m.read('ash')).toEqual({ woodcutting: 7, mining: 2, farming: 4 });
    expect(m.read('tide')).toBeNull();
    storage.data['iot.toast.levels.tide'] = 'not json';
    expect(m.read('tide')).toBeNull();
    storage.data['iot.toast.levels.tide'] =
      '{"woodcutting":"7","mining":2.5,"farming":4,"smithing":9}';
    expect(m.read('tide')).toEqual({ farming: 4 });
  });

  it('without storage nothing is remembered (the next landing toasts nothing), and a failing store is no error', () => {
    const none = new LevelMemory(null);
    none.write('ash', { woodcutting: 7, mining: 2, farming: 4 });
    expect(none.read('ash')).toBeNull();
    const broken = new LevelMemory({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => {
      broken.write('ash', { woodcutting: 7, mining: 2, farming: 4 });
    }).not.toThrow();
    expect(broken.read('ash')).toBeNull();
  });
});

describe('the Writ-low memory', () => {
  const fake = fakeStorage;

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
