import {
  hexOf,
  isDoorPieceName,
  isFloorWeights,
  isMidWeights,
  isTileRule,
  paletteData,
  SPRITE_WHITELIST,
  staticTilePiece,
  TILE_RULES,
  TILE_WORLD_PX,
  tileDoorAnimsFor,
  tileFramesFor,
  tileSetOf,
  type TileSheet,
} from '../src/index.js';
import type { Rgba } from './sheetChecks.js';

const WHITELIST = new Set(SPRITE_WHITELIST);
const TELEGRAPH = new Set(paletteData.signals.telegraph.map((h) => h.toLowerCase()));
const NEVER = new Set([paletteData.signals.hit, paletteData.tokens['spark-glow']].map((h) => h.toLowerCase()));

/**
 * What breaks the tile-sheet contract (docs/design/sprites.md "Tiles", §6) in
 * a `tiles-<set>` sheet and its PNG: meta version "2" and pixelScale 1, the
 * PNG the size of `meta.size`; every piece of its rule and, with doors, every
 * door frame of tiles.ts there at its size, inside the PNG, on no other
 * frame, and nothing else (a doorless set carries no door piece or
 * animation); the door animations with their frame counts and rates; the
 * `tiles` block (tile size 32, `rule` cave or shore when present, `doors` a
 * boolean when present, `floorWeights` four positive integers, the mid
 * weights of its rule two each when present); only whitelist colours (no
 * telegraph colours, never #FFFFFF or #FFE7A3), no soft alpha, and each
 * piece's opacity (floors, faces, tops and door frames fully opaque; drops
 * opaque in their top row). An empty list is a sheet that passes.
 */
export function tileSheetProblems(name: string, sheet: TileSheet, png: Rgba): string[] {
  const problems: string[] = [];
  const { meta } = sheet;
  if (meta.image !== `${name}.png`) problems.push(`meta.image is ${meta.image}, not ${name}.png`);
  if (meta.version !== '2') problems.push(`meta.version is ${meta.version}, not "2"`);
  if (meta.pixelScale !== 1) problems.push(`meta.pixelScale is ${String(meta.pixelScale)}, not 1`);
  if (png.width !== meta.size.w || png.height !== meta.size.h)
    problems.push(`the PNG is ${png.width}×${png.height}, meta.size ${meta.size.w}×${meta.size.h}`);

  const tiles = (sheet as { tiles?: unknown }).tiles as Partial<TileSheet['tiles']> | undefined;
  const set = tileSetOf(tiles);
  if (!tiles) problems.push('no tiles block');
  else {
    if (tiles.tileSize !== TILE_WORLD_PX) problems.push(`tiles.tileSize is ${String(tiles.tileSize)}, not ${TILE_WORLD_PX}`);
    if (tiles.rule !== undefined && !isTileRule(tiles.rule))
      problems.push(`tiles.rule is ${JSON.stringify(tiles.rule)}, not one of ${TILE_RULES.join(', ')}`);
    if (tiles.doors !== undefined && typeof tiles.doors !== 'boolean')
      problems.push(`tiles.doors is ${JSON.stringify(tiles.doors)}, not true or false`);
    if (!isFloorWeights(tiles.floorWeights))
      problems.push(`tiles.floorWeights is ${JSON.stringify(tiles.floorWeights)}, not four positive integers`);
    for (const k of ['faceMidWeights', 'topMidWeights', 'dropMidWeights'] as const) {
      if (tiles[k] === undefined) continue;
      const of = k === 'dropMidWeights' ? 'shore' : 'cave';
      if (!isMidWeights(tiles[k])) problems.push(`tiles.${k} is ${JSON.stringify(tiles[k])}, not two positive integers`);
      else if (set.rule !== of) problems.push(`tiles.${k} is for the ${of} rule, and this set's rule is ${set.rule}`);
    }
  }

  const frames = tileFramesFor(set);
  const expected = new Map(frames.map((f) => [f.name, f]));
  for (const f of frames) {
    const got = sheet.frames[f.name];
    if (!got) {
      problems.push(`${f.name} is missing`);
      continue;
    }
    const r = got.frame;
    if (r.w !== f.w || r.h !== f.h) problems.push(`${f.name} is ${r.w}×${r.h}, not ${f.w}×${f.h}`);
    if (r.x < 0 || r.y < 0 || r.x + r.w > png.width || r.y + r.h > png.height) problems.push(`${f.name} lies outside the PNG`);
    if (got.rotated || got.trimmed) problems.push(`${f.name} is rotated or trimmed`);
  }
  for (const n of Object.keys(sheet.frames)) {
    if (expected.has(n)) continue;
    if (isDoorPieceName(n)) problems.push(`${n} is a door frame, but the set has no doors (tiles.doors false)`);
    else if (staticTilePiece(n)) problems.push(`${n} is not a piece of the ${set.rule} rule`);
    else problems.push(`${n} is not a tile piece or door frame`);
  }
  const rects = Object.entries(sheet.frames);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [an, a] = rects[i] ?? ['', null];
      const [bn, b] = rects[j] ?? ['', null];
      if (!a || !b) continue;
      const A = a.frame;
      const B = b.frame;
      if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) problems.push(`${an} and ${bn} overlap`);
    }
  }

  const doorAnims = tileDoorAnimsFor(set);
  for (const row of doorAnims) {
    const a = sheet.anims[row.name];
    if (!a) {
      problems.push(`anims.${row.name} is missing`);
      continue;
    }
    const frames = Array.from({ length: row.frames }, (_, n) => `${row.name}_${n}`);
    if (JSON.stringify(a.frames) !== JSON.stringify(frames))
      problems.push(`anims.${row.name} has frames ${a.frames.join(' ')}, not the ${row.frames} of ${frames.join(' ')}`);
    if (a.frameRate !== row.fps) problems.push(`anims.${row.name} runs at ${a.frameRate} fps, not ${row.fps}`);
    if (a.repeat !== 0 || a.hold !== true) problems.push(`anims.${row.name} must play once and hold its last frame`);
  }
  for (const k of Object.keys(sheet.anims)) {
    if (doorAnims.some((r) => r.name === k)) continue;
    problems.push(
      isDoorPieceName(k) ? `anims.${k} is a door animation, but the set has no doors (tiles.doors false)` : `anims.${k} is not a door animation`,
    );
  }

  const offList = new Set<string>();
  const telegraph = new Set<string>();
  const never = new Set<string>();
  const soft = new Set<string>();
  const holes = new Set<string>();
  const topHoles = new Set<string>();
  for (const [frameName, got] of rects) {
    const spec = expected.get(frameName);
    const r = got.frame;
    for (let y = r.y; y < Math.min(r.y + r.h, png.height); y++) {
      for (let x = r.x; x < Math.min(r.x + r.w, png.width); x++) {
        const i = (y * png.width + x) * 4;
        const alpha = png.rgba[i + 3] ?? 0;
        if (alpha === 0) {
          if (spec?.opacity === 'full') holes.add(frameName);
          else if (spec?.opacity === 'top' && y === r.y) topHoles.add(frameName);
          continue;
        }
        if (alpha !== 255) soft.add(frameName);
        const hex = hexOf(png.rgba[i] ?? 0, png.rgba[i + 1] ?? 0, png.rgba[i + 2] ?? 0);
        if (NEVER.has(hex)) never.add(hex);
        else if (TELEGRAPH.has(hex)) telegraph.add(frameName);
        else if (!WHITELIST.has(hex)) offList.add(hex);
      }
    }
  }
  if (holes.size) problems.push(`transparent pixels in pieces that must be opaque: ${[...holes].join(', ')}`);
  if (topHoles.size) problems.push(`transparent pixels in the top row of pieces that must be opaque at the top: ${[...topHoles].join(', ')}`);
  if (soft.size) problems.push(`semi-transparent pixels: ${[...soft].join(', ')}`);
  if (offList.size) problems.push(`colours outside the whitelist: ${[...offList].join(', ')}`);
  if (never.size) problems.push(`colours never allowed in a sheet: ${[...never].join(', ')}`);
  if (telegraph.size) problems.push(`telegraph colours in a tile sheet: ${[...telegraph].join(', ')}`);
  return problems;
}
