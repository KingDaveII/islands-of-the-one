import { CHEST_SHEET, SPRITE_SHEET_NAMES, spriteSheets, type SpriteSheet } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../../packages/shared/test/fixtures/prop-chest.json' with { type: 'json' };
import { chestFrameAt } from './chestSprites.js';
import { loopFrameAt, nextOpenView, openingStateAt, type OpenView } from './opening.js';

const fixture: SpriteSheet = fixtureJson;

/** The chest's frame at each (opened, timeMs) in turn, as the client sees them. */
function run(sheet: SpriteSheet, states: [boolean, number][]): string[] {
  let view: OpenView | null = null;
  return states.map(([opened, t]) => {
    view = nextOpenView(view, opened, t);
    return chestFrameAt(sheet, view, t);
  });
}

describe('the chest from the prop-chest fixture, from `opened` on the client clock', () => {
  it('loops closed at the sheet\'s rate while opened is false (2 frames at 2 fps: the glint)', () => {
    expect(run(fixture, [[false, 0], [false, 499], [false, 500], [false, 999], [false, 1000], [false, 1700]])).toEqual([
      'closed_0',
      'closed_0',
      'closed_1',
      'closed_1',
      'closed_0',
      'closed_1',
    ]);
  });

  it('is still with a 1-frame closed', () => {
    const still: SpriteSheet = { ...fixture, anims: { ...fixture.anims, closed: { frames: ['closed_0'], frameRate: 0, repeat: 0, hold: true } } };
    expect(run(still, [[false, 0], [false, 500], [false, 5000]])).toEqual(['closed_0', 'closed_0', 'closed_0']);
    expect(loopFrameAt(1, 8, 5000)).toBe(0);
    expect(loopFrameAt(2, 0, 5000)).toBe(0);
    expect(loopFrameAt(4, 8, 625)).toBe(1);
  });

  it('plays opening once at 12 fps when opened turns true, every frame, then holds open', () => {
    expect(
      run(fixture, [
        [false, 0],
        [true, 1000],
        [true, 1040],
        [true, 1084],
        [true, 1167],
        [true, 1250],
        [true, 1333],
        [true, 1334],
        [true, 9000],
      ]),
    ).toEqual([
      'closed_0',
      'opening_0',
      'opening_0',
      'opening_1',
      'opening_2',
      'opening_3',
      'opening_3',
      'open_0',
      'open_0',
    ]);
  });

  it('shows open at once for a chest already open when the client first sees it', () => {
    expect(run(fixture, [[true, 300], [true, 310], [true, 5000]])).toEqual(['open_0', 'open_0', 'open_0']);
  });

  it("takes opening's count and rate from the sheet, and skips to open on a sheet without it", () => {
    const slow: SpriteSheet = {
      ...fixture,
      anims: { ...fixture.anims, opening: { frames: ['opening_0', 'opening_1'], frameRate: 4, repeat: 0, hold: true } },
    };
    const view = nextOpenView(nextOpenView(null, false, 0), true, 100);
    expect(chestFrameAt(slow, view, 100 + 260)).toBe('opening_1');
    expect(chestFrameAt(slow, view, 100 + 500)).toBe('open_0');
    expect(chestFrameAt(fixture, view, 100 + 260)).toBe('opening_3');
    const rest = Object.fromEntries(Object.entries(fixture.anims).filter(([k]) => k !== 'opening'));
    expect(chestFrameAt({ ...fixture, anims: rest }, view, 100)).toBe('open_0');
    expect(openingStateAt(view, { frames: 4, fps: 12 }, 100 + 250)).toEqual({ state: 'opening', n: 3 });
  });
});

describe('which chest the world draws', () => {
  it("ART's prop-chest, one of the sprite sheets the client loads, and nothing else", () => {
    expect(SPRITE_SHEET_NAMES).toContain(CHEST_SHEET);
    const sheet = spriteSheets[CHEST_SHEET];
    expect(sheet).not.toBe(fixture);
    expect(sheet.meta.image).toBe('prop-chest.png');
    // Its states play as the fixture's do: closed with the glint, opening once, open held.
    const view = nextOpenView(nextOpenView(null, false, 0), true, 100);
    expect(chestFrameAt(sheet, nextOpenView(null, false, 0), 0)).toBe('closed_0');
    expect(chestFrameAt(sheet, view, 100)).toBe('opening_0');
    expect(chestFrameAt(sheet, view, 100 + 250)).toBe('opening_3');
    expect(chestFrameAt(sheet, view, 100 + 334)).toBe('open_0');
  });
});
