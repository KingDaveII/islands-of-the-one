import { holdingLayout, type HoldingResponse } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import {
  chipState,
  clockOffset,
  countOf,
  cycleProgress,
  cyclesDone,
  interactPoint,
  nearestStation,
  packFill,
  pluralName,
  propBase,
  purseGin,
  serverTime,
  stationInitials,
  stationLines,
  takeResultLine,
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
  baskets: { 'writ-post': [], 'twisted-trees': [{ itemId: 'twisted-log', quantity: 3 }], 'stone-outcrop': [] },
  activity: { stationId: 'twisted-trees', startedAt: iso(0), cycleMs: 4000 },
  now: iso(13_000),
  skills: {
    woodcutting: { xp: 44, level: 2, into: 4, toNext: 1099 },
    mining: { xp: 0, level: 1, into: 0, toNext: 40 },
    farming: { xp: 0, level: 1, into: 0, toNext: 40 },
  },
};
const idle: HoldingResponse = { ...working, activity: null };

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
  it('names the station, its rate, the basket, the skill, and the buttons; "You:" only while working here', () => {
    expect(stationLines('twisted-trees', working)).toEqual({
      title: 'TWISTED TREES',
      rate: '1 twisted log every 4 s',
      basket: 'Basket: 3 twisted logs',
      you: 'You: 1 log every 4 s',
      skill: 'Woodcutting 2 · 1099 XP to next',
      work: 'STOP',
      take: 'TAKE ALL',
      working: true,
    });
    expect(stationLines('stone-outcrop', working)).toEqual({
      title: 'STONE OUTCROP',
      rate: '1 black stone every 6 s',
      basket: 'Basket: empty',
      you: null,
      skill: 'Mining 1 · 40 XP to next',
      work: 'WORK HERE',
      take: 'TAKE ALL',
      working: false,
    });
    expect(stationLines('twisted-trees', null)?.skill).toBe('Woodcutting');
    // The post has no panel: Use opens the inventory with the store.
    expect(stationLines('writ-post', working)).toBeNull();
    expect(stationLines('field', working)).toBeNull();
    expect(countOf('twisted-log', 1)).toBe('1 twisted log');
    expect(countOf('black-stone', 12)).toBe('12 black stones');
    expect(pluralName('twisted-log')).toBe('twisted logs');
  });

  it("gives the take-all line: GAME DESIGN's full-store line when something stayed, else what was taken", () => {
    expect(takeResultLine({ stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 4 }], left: [{ itemId: 'twisted-log', quantity: 6 }] })).toBe(
      'Store: twisted logs full.',
    );
    expect(takeResultLine({ stationId: 'twisted-trees', moved: [], left: [{ itemId: 'twisted-log', quantity: 6 }] })).toBe('Store: twisted logs full.');
    expect(takeResultLine({ stationId: 'twisted-trees', moved: [{ itemId: 'twisted-log', quantity: 3 }], left: [] })).toBe('Took 3 twisted logs.');
    expect(takeResultLine({ stationId: 'stone-outcrop', moved: [], left: [] })).toBe('Nothing to take.');
  });
});

describe('the prompt and the props', () => {
  const layout = holdingLayout();
  const trees = layout.stations.find((s) => s.id === 'twisted-trees');
  const post = layout.stations.find((s) => s.id === 'writ-post');
  if (!trees || !post) throw new Error('no stations');

  it('prompts for the nearest station whose interact point is in reach, by the sim distance', () => {
    expect(interactPoint(trees)).toEqual({ x: 88, y: 168 });
    expect(nearestStation(88, 168, 40, layout)?.id).toBe('twisted-trees');
    expect(nearestStation(88 + 39, 168, 40, layout)?.id).toBe('twisted-trees');
    expect(nearestStation(88 + 41, 168, 40, layout)).toBeNull();
    // Between the post (14, 10) and the start: the post is nearest.
    expect(nearestStation(232, 180, 40, layout)?.id).toBe('writ-post');
    expect(nearestStation(0, 0, 40, layout)).toBeNull();
  });

  it("stands a prop on the bottom centre of its station's rectangle", () => {
    expect(propBase(trees)).toEqual({ x: 64, y: 176 });
    expect(propBase(post)).toEqual({ x: 232, y: 160 });
  });

  it('fills the pack button and reads the purse from the inventory', () => {
    expect(packFill(null)).toBe('0/20');
    expect(packFill({ purse: [{ itemId: 'sealed-gin', quantity: 120 }], pack: [{ itemId: 'black-stone', quantity: 120 }], store: [], baskets: {} })).toBe('3/20');
    expect(purseGin({ purse: [{ itemId: 'sealed-gin', quantity: 120 }], pack: [], store: [], baskets: {} })).toBe(120);
    expect(purseGin(null)).toBe(0);
  });
});
