import { CAVE_TILE_SHEET, caveTileSheet, roomTemplates, tileAt, type TileSheet, type TileTemplate } from '@iot/shared';
import { describe, expect, it } from 'vitest';
import fixtureJson from '../../../../packages/shared/test/fixtures/tiles-fixture.json' with { type: 'json' };
import { doorFrameAt, nextDoorView, roomTextureSize, roomTileFrames, TILE_SHEET, type DoorView } from './roomTiles.js';

const fixture: TileSheet = fixtureJson;
const W = fixture.tiles;

function template(name: string): TileTemplate {
  const t = roomTemplates.find((r) => r.name === name);
  if (!t) throw new Error(`no ${name} in rooms.json`);
  return t;
}

/** The pieces drawn at a cell, base first, as the room texture gets them. */
function piecesAt(t: TileTemplate, col: number, row: number): string[] {
  return roomTileFrames(t, fixture)
    .pieces.filter((p) => p.x === col * 32 && p.y === row * 32)
    .map((p) => p.frame);
}

describe('the room from the tile fixture (tileAt on rooms.json)', () => {
  const shell = template('Shell Gallery');
  const narrow = template('Narrow Hollow');

  it('names only frames the sheet has, at cell × 32 world px', () => {
    for (const t of [shell, narrow]) {
      const { pieces } = roomTileFrames(t, fixture);
      for (const p of pieces) {
        expect(fixture.frames[p.frame], `${t.name} ${p.frame}`).toBeDefined();
        expect(p.x % 32).toBe(0);
        expect(p.y % 32).toBe(0);
      }
    }
  });

  it('puts plain faces under the north wall, a face beside the door', () => {
    // Shell Gallery row 0: wall over open floor, with no side open but S.
    for (const col of [1, 5, 14, 17, 30]) expect(piecesAt(shell, col, 0)[0], `col ${col}`).toMatch(/^face_mid_[01]$/);
    for (const col of [1, 20, 38]) expect(piecesAt(narrow, col, 0)[0], `col ${col}`).toMatch(/^face_mid_[01]$/);
    // The two variants both show along a long wall.
    const variants = new Set(Array.from({ length: 38 }, (_, c) => piecesAt(narrow, c + 1, 0)[0]));
    expect([...variants].sort()).toEqual(['face_mid_0', 'face_mid_1']);
  });

  it("draws a pillar's top row as tops open N and to the side, its lower row as faces", () => {
    // Shell Gallery's 2×2 pillar at cols 7–8, rows 4–5.
    expect(piecesAt(shell, 7, 4)).toEqual(['top_nw']);
    expect(piecesAt(shell, 8, 4)).toEqual(['top_ne']);
    expect(piecesAt(shell, 7, 5)).toEqual(['face_w']);
    expect(piecesAt(shell, 8, 5)).toEqual(['face_e']);
    // Its long block at cols 14–17, rows 8–9: the middle of the top row is open N only.
    expect(piecesAt(shell, 15, 8)).toEqual(['top_n']);
    expect(piecesAt(shell, 15, 9)[0]).toMatch(/^face_mid_[01]$/);
    // Narrow Hollow's pillars the same way.
    expect(piecesAt(narrow, 9, 4)).toEqual(['top_nw']);
    expect(piecesAt(narrow, 10, 5)).toEqual(['face_e']);
  });

  it('puts both inner corners of the south wall on its tops', () => {
    expect(piecesAt(shell, 0, 18)).toEqual([expect.stringMatching(/^top_mid_[01]$/), 'corner_ne']);
    expect(piecesAt(shell, 31, 18)).toEqual([expect.stringMatching(/^top_mid_[01]$/), 'corner_nw']);
    expect(piecesAt(narrow, 0, 9)).toEqual([expect.stringMatching(/^top_mid_[01]$/), 'corner_ne']);
    expect(piecesAt(narrow, 39, 9)).toEqual([expect.stringMatching(/^top_mid_[01]$/), 'corner_nw']);
    // The side walls are tops open to the room, the south wall tops open N.
    expect(piecesAt(shell, 0, 9)).toEqual(['top_e']);
    expect(piecesAt(shell, 31, 9)).toEqual(['top_w']);
    expect(piecesAt(shell, 10, 18)).toEqual(['top_n']);
  });

  it('places the side door whole, and the walls round it read it as solid', () => {
    const { doors } = roomTileFrames(narrow, fixture);
    expect(doors).toEqual([{ piece: 'door_e', col: 39, row: 4, cols: 1, rows: 2 }]);
    expect(piecesAt(narrow, 39, 4)).toEqual([]);
    expect(piecesAt(narrow, 39, 5)).toEqual([]);
    // The floor beside it is shaded from the east; the wall above it is a top (its S is the door).
    expect(piecesAt(narrow, 38, 4).slice(1)).toEqual(['shade_e']);
    expect(piecesAt(narrow, 39, 3)).toEqual(['top_w']);
    expect(piecesAt(narrow, 39, 6)).toEqual(['top_w']);
    // The Shell Gallery's north door covers two cells.
    expect(roomTileFrames(shell, fixture).doors).toEqual([{ piece: 'door_n', col: 15, row: 0, cols: 2, rows: 1 }]);
  });

  it('stacks the shades in a corner of the floor, and diagonal to a pillar', () => {
    const [floor, ...shades] = piecesAt(shell, 1, 1);
    expect(floor).toMatch(/^floor_[0-3]$/);
    expect(shades).toEqual(['shade_n', 'shade_w']);
    expect(piecesAt(shell, 30, 1).slice(1)).toEqual(['shade_n', 'shade_e']);
    // Under the north door the floor is shaded too: a door is solid for its neighbours.
    expect(piecesAt(shell, 15, 1).slice(1)).toEqual(['shade_n']);
    // SE of the pillar at cols 7–8, rows 4–5: shade_nw alone.
    expect(piecesAt(shell, 9, 6).slice(1)).toEqual(['shade_nw']);
    expect(piecesAt(shell, 6, 6).slice(1)).toEqual(['shade_ne']);
  });

  it('draws the same floors as the pipeline (the same rule and hash)', () => {
    const at = tileAt(shell, 12, 10, W);
    expect(piecesAt(shell, 12, 10)).toEqual([at.base, ...at.overlays]);
  });
});

describe('the room texture', () => {
  it('is cols × 32 by rows × 32 for every template (the widest row counts)', () => {
    for (const t of roomTemplates) {
      const cols = Math.max(...t.tiles.map((r) => r.length));
      expect(roomTextureSize(t), t.name).toEqual({ w: cols * 32, h: t.tiles.length * 32 });
    }
    expect(roomTextureSize(template('Narrow Hollow'))).toEqual({ w: 1280, h: 320 });
    expect(roomTextureSize(template('Shell Gallery'))).toEqual({ w: 1024, h: 608 });
    expect(roomTextureSize({ name: 'ragged', tiles: ['###', '#....', '#'] })).toEqual({ w: 160, h: 96 });
  });

  it('never asks for an empty texture', () => {
    expect(roomTextureSize({ name: 'empty', tiles: [] })).toEqual({ w: 1, h: 1 });
  });
});

describe('the door, from doorOpen on the client clock', () => {
  const run = (states: [boolean, number][]): string[] => {
    let view: DoorView | null = null;
    return states.map(([open, t]) => {
      view = nextDoorView(view, open, t);
      return doorFrameAt(fixture, 'door_n', view, t);
    });
  };

  it('is closed while doorOpen is false', () => {
    expect(run([[false, 0], [false, 500], [false, 5000]])).toEqual(['door_n_closed_0', 'door_n_closed_0', 'door_n_closed_0']);
  });

  it('plays opening once at 12 fps when doorOpen turns true, then holds open', () => {
    const frames = run([
      [false, 0],
      [true, 1000],
      [true, 1040],
      [true, 1084],
      [true, 1250],
      [true, 1416],
      [true, 1499],
      [true, 1500],
      [true, 9000],
    ]);
    expect(frames).toEqual([
      'door_n_closed_0',
      'door_n_opening_0',
      'door_n_opening_0',
      'door_n_opening_1',
      'door_n_opening_3',
      'door_n_opening_4',
      'door_n_opening_5',
      'door_n_open_0',
      'door_n_open_0',
    ]);
  });

  it('shows open at once in a room that loads with the door already open', () => {
    expect(run([[true, 300], [true, 310]])).toEqual(['door_n_open_0', 'door_n_open_0']);
  });

  it("takes the opening's rate from the sheet", () => {
    const slow: TileSheet = {
      ...fixture,
      anims: { ...fixture.anims, door_w_opening: { frames: fixture.anims.door_w_opening?.frames ?? [], frameRate: 6, repeat: 0, hold: true } },
    };
    const view = nextDoorView(nextDoorView(null, false, 0), true, 100);
    expect(doorFrameAt(slow, 'door_w', view, 100 + 170)).toBe('door_w_opening_1');
    expect(doorFrameAt(fixture, 'door_w', view, 100 + 170)).toBe('door_w_opening_2');
  });
});

describe('which room the world draws', () => {
  it("ART's tiles-cave, bundled with the code, and nothing else", () => {
    expect(TILE_SHEET).toEqual({ key: CAVE_TILE_SHEET, sheet: caveTileSheet });
    expect(TILE_SHEET.sheet.meta.image).toBe('tiles-cave.png');
    // The shipped sheet draws the same rooms as the fixture: the same pieces at the same cells, only the weights differ.
    const shell = template('Shell Gallery');
    const fromCave = roomTileFrames(shell, caveTileSheet).pieces.map((p) => `${p.x},${p.y}:${p.frame.replace(/_[0-9]$/, '')}`);
    const fromFixture = roomTileFrames(shell, fixture).pieces.map((p) => `${p.x},${p.y}:${p.frame.replace(/_[0-9]$/, '')}`);
    expect(fromCave).toEqual(fromFixture);
  });
});
