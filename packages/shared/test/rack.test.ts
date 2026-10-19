import { describe, expect, it } from 'vitest';
import {
  ApiRoute,
  ApiErrorCode,
  isDrawable,
  isRackChooseRequest,
  isRackView,
  isRackWeaponView,
  kitLine,
  kitRef,
  PROTOCOL_VERSION,
  RACK_PLACE,
  RACK_TEXT,
  rackWeapons,
  resolveChosen,
} from '../src/index.js';
import { BANNED } from './banned.js';

/**
 * The weapon rack (docs/design/holding.md "The weapon rack", M2 Task 8):
 * RACK_TEXT's lines (LORE's word for word, drawable, clear of the banned
 * names), the kit ref, the rack's weapons in roster order with their
 * readiness, the resolved choice, the kit line, and the guards for the rack
 * in the holding answer and the choose body.
 */
describe('RACK_TEXT', () => {
  it("holds LORE's lines word for word, GAME DESIGN's smith line kept for the Forge, every line drawable and clear of the banned names", () => {
    expect(RACK_TEXT).toEqual({
      TITLE: 'Weapon rack',
      TOOLTIP: 'Every weapon you own hangs here. Take one out with you; the others wait.',
      STATION_TIP: 'Weapon rack: Every weapon you own hangs here. Take one out with you; the others wait.',
      TAKEN: 'Taken',
      TAKE: 'TAKE',
      NOT_READY: "Your hands aren't ready for this one yet.",
      NEEDS_SMITH: 'It needs a smith who knows it',
      FROM_RACK: 'Taken from your weapon rack.',
      KIT_JOIN: ' · ',
    });
    for (const [key, line] of Object.entries(RACK_TEXT)) {
      expect(isDrawable(line), key).toBe(true);
      expect(BANNED.test(line), key).toBe(false);
    }
    expect(RACK_PLACE).toBe('rack');
    expect(ApiRoute.RackChoose).toBe('/api/holding/rack/choose');
    expect(ApiErrorCode.NotOwned).toBe('not-owned');
    expect(ApiErrorCode.NotReady).toBe('not-ready');
    // The rack in the holding answer is a breaking wire change.
    expect(PROTOCOL_VERSION).toBe(8);
  });
});

describe('the rack', () => {
  it('refs the kit once per Kindled and weapon', () => {
    expect(kitRef('11111111-2222-3333-4444-555555555555', 'hookblade')).toBe('kit:11111111-2222-3333-4444-555555555555:hookblade');
  });

  it('lists the weapons owned in roster order with whether each can fight, weapons only, each once', () => {
    expect(rackWeapons(['keelmaul', 'hookblade', 'twisted-log', 'hookblade', 'no-such'])).toEqual([
      { itemId: 'hookblade', ready: true },
      { itemId: 'keelmaul', ready: false },
    ]);
    expect(rackWeapons(['sling', 'keelmaul', 'hookblade'], () => true)).toEqual([
      { itemId: 'hookblade', ready: true },
      { itemId: 'sling', ready: true },
      { itemId: 'keelmaul', ready: true },
    ]);
    expect(rackWeapons([])).toEqual([]);
  });

  it('resolves the chosen weapon: the stored one while owned and ready, else the first ready in roster order, else null', () => {
    const all = rackWeapons(['hookblade', 'sling', 'keelmaul']);
    expect(resolveChosen(all, null)).toBe('hookblade');
    expect(resolveChosen(all, 'hookblade')).toBe('hookblade');
    // Stored but not ready (the Sling is locked): the first ready one.
    expect(resolveChosen(all, 'sling')).toBe('hookblade');
    // Stored but not owned.
    expect(resolveChosen(rackWeapons(['hookblade']), 'keelmaul')).toBe('hookblade');
    // Nothing owned, or nothing that can fight: null (M2's kit never allows it).
    expect(resolveChosen([], null)).toBeNull();
    expect(resolveChosen(rackWeapons(['sling', 'keelmaul']), 'sling')).toBeNull();
    const ready = rackWeapons(['hookblade', 'sling', 'keelmaul'], () => true);
    expect(resolveChosen(ready, 'keelmaul')).toBe('keelmaul');
    expect(resolveChosen(ready, null)).toBe('hookblade');
  });

  it('joins the kit in input order with the divider', () => {
    expect(kitLine('hookblade')).toBe('Arc · Hook-thrust · Haul');
    expect(kitLine('sling')).toBe('');
    expect(kitLine('twisted-log')).toBe('');
  });

  it('guards the rack in the answer: weapons once each, chosen one of the ready ones or null only while none is', () => {
    const ok = { weapons: [{ itemId: 'hookblade', ready: true }, { itemId: 'sling', ready: false }], chosen: 'hookblade' };
    expect(isRackView(ok)).toBe(true);
    expect(isRackView({ weapons: [], chosen: null })).toBe(true);
    expect(isRackView({ weapons: [{ itemId: 'sling', ready: false }], chosen: null })).toBe(true);
    expect(isRackView({ ...ok, chosen: null })).toBe(false);
    expect(isRackView({ ...ok, chosen: 'sling' })).toBe(false);
    expect(isRackView({ ...ok, chosen: 'keelmaul' })).toBe(false);
    expect(isRackView({ weapons: [{ itemId: 'hookblade', ready: true }, { itemId: 'hookblade', ready: true }], chosen: 'hookblade' })).toBe(false);
    expect(isRackView({ ...ok, extra: 1 })).toBe(false);
    expect(isRackView({ weapons: ok.weapons })).toBe(false);
    expect(isRackView({ weapons: [{ itemId: 'hookblade' }], chosen: 'hookblade' })).toBe(false);
    expect(isRackView({ weapons: [{ itemId: 'hookblade', ready: 'yes' }], chosen: 'hookblade' })).toBe(false);
    expect(isRackWeaponView({ itemId: 'hookblade', ready: true })).toBe(true);
    expect(isRackWeaponView({ itemId: 'hookblade', ready: true, kit: [] })).toBe(false);
    expect(isRackView(null)).toBe(false);
  });

  it('guards the choose body: exactly { weaponId }, a string; the route judges the weapon', () => {
    expect(isRackChooseRequest({ weaponId: 'hookblade' })).toBe(true);
    expect(isRackChooseRequest({ weaponId: 'banana' })).toBe(true);
    expect(isRackChooseRequest({ weaponId: 1 })).toBe(false);
    expect(isRackChooseRequest({})).toBe(false);
    expect(isRackChooseRequest({ weaponId: 'hookblade', extra: 1 })).toBe(false);
    expect(isRackChooseRequest('hookblade')).toBe(false);
  });
});
