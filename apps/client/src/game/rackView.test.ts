import { defaultTuning, RACK_TEXT, type RackView } from '@iot/shared';
import type { Tuning } from '@iot/sim';
import { describe, expect, it } from 'vitest';
import { moveRackFocus, rackPressable, rackRows, startWeapon, weaponName } from './rackView.js';

/**
 * The weapon rack's client logic (docs/design/holding.md "The weapon rack",
 * M2 Task 8): the panel's rows and their states from the answer's `rack`,
 * the focus through them, and the start screen's weapon from a holding
 * answer and its fallback without one.
 */
const t: Tuning = defaultTuning;
const m2: RackView = { weapons: [{ itemId: 'hookblade', ready: true }], chosen: 'hookblade' };
const three: RackView = {
  weapons: [
    { itemId: 'hookblade', ready: true },
    { itemId: 'sling', ready: false },
    { itemId: 'keelmaul', ready: true },
  ],
  chosen: 'keelmaul',
};

describe('rackRows', () => {
  it("M2: one row, the Hookblade, Taken, with LORE's card and its kit in input order", () => {
    expect(rackRows(m2)).toEqual([
      {
        itemId: 'hookblade',
        name: 'Hookblade',
        card: 'A short curved blade with a hook on its back and a coil of cord at the pommel. For getting close, and pulling things closer.',
        kit: 'Arc · Hook-thrust · Haul',
        state: 'taken',
        stateText: RACK_TEXT.TAKEN,
      },
    ]);
  });

  it('three weapons: the taken one highlighted, an owned one that can fight takes, one the sim can\'t run is greyed with LORE\'s line; roster order kept', () => {
    const rows = rackRows(three);
    expect(rows.map((r) => [r.itemId, r.name, r.state, r.stateText])).toEqual([
      ['hookblade', 'Hookblade', 'take', null],
      ['sling', 'Sling', 'not-ready', "Your hands aren't ready for this one yet."],
      ['keelmaul', 'Keelmaul', 'taken', 'Taken'],
    ]);
    expect(rows[1]?.kit).toBe('');
    expect(rows[1]?.card).toBe('A leather sling and a pouch of clay pellets, each pellet pressed with a mark. For keeping your distance.');
    expect(rows[2]?.card).toBe("A maul made from a piece of ship's keel, banded in iron. Heavy. For when there's no going around.");
    // A weapon not owned has no row; nothing owned, no rows.
    expect(rackRows({ weapons: [], chosen: null }).length).toBe(0);
    expect(rackRows({ weapons: [{ itemId: 'sling', ready: false }], chosen: null })).toEqual([
      expect.objectContaining({ itemId: 'sling', state: 'not-ready' }),
    ]);
  });

  it('presses only a TAKE row', () => {
    const rows = rackRows(three);
    expect(rows.map(rackPressable)).toEqual([true, false, false]);
    expect(rackPressable(undefined)).toBe(false);
  });
});

describe('moveRackFocus', () => {
  it('wraps through the rows; stays at 0 with none', () => {
    expect(moveRackFocus(3, 0, 1)).toBe(1);
    expect(moveRackFocus(3, 2, 1)).toBe(0);
    expect(moveRackFocus(3, 0, -1)).toBe(2);
    expect(moveRackFocus(1, 0, 1)).toBe(0);
    expect(moveRackFocus(0, 0, 1)).toBe(0);
  });
});

describe('startWeapon', () => {
  it("takes the rack's choice from a holding answer, with LORE's line", () => {
    expect(startWeapon({ rack: m2 }, t)).toEqual({ weapon: 'hookblade', name: 'Hookblade', line: 'Taken from your weapon rack.' });
    expect(startWeapon({ rack: three }, t)).toEqual({ weapon: 'keelmaul', name: 'Keelmaul', line: 'Taken from your weapon rack.' });
  });

  it("falls back to the roster's first weapon that can fight when the answer can't be had, and the line says nothing", () => {
    expect(startWeapon(null, t)).toEqual({ weapon: 'hookblade', name: 'Hookblade', line: null });
    // An answer whose rack has nothing that can fight (never in M2) falls back the same way.
    expect(startWeapon({ rack: { weapons: [{ itemId: 'sling', ready: false }], chosen: null } }, t)).toEqual({ weapon: 'hookblade', name: 'Hookblade', line: null });
    // With nothing available at all the Hookblade is still the id the run asks for (the sim refuses it; the test bed's old behaviour).
    const locked: Tuning = { ...t, weaponRoster: t.weaponRoster.map((w) => ({ ...w, locked: true })) };
    expect(startWeapon(null, locked).weapon).toBe('hookblade');
  });

  it('names a weapon from items.json, else the tuning', () => {
    expect(weaponName('hookblade', t)).toBe('Hookblade');
    expect(weaponName('sling', t)).toBe('Sling');
    expect(weaponName('no-such', t)).toBe('no-such');
  });
});
