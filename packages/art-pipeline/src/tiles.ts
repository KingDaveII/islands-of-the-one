import {
  doorFrameName,
  doorlessProblems,
  holdingData,
  holdingTemplate,
  roomTemplates,
  roomTiles,
  TILE_WORLD_PX,
  tileDoorAnimsFor,
  tileFramesFor,
  tileRecipePiecesFor,
  type TileOpacity,
  type TileSetSpec,
  type TileSheetTiles,
  type TileTemplate,
  type TileWeights,
} from '@iot/shared';
import { APP_ID, ASSET_DIR, REVIEW_DIR } from './build.js';
import { describeHex, FLOOR, HOLLOW_DEEP, WALL } from './colour.js';
import { PipelineError } from './errors.js';
import { blank, blit, fillRect, opaqueAt, setPixel, type Img } from './image.js';
import { encodePng } from './png.js';
import { recipeTileSet, tileFrameName, type Recipe } from './recipe.js';
import {
  applyRemap,
  appliesTo,
  ruleMaps,
  ruleScope,
  staleRules,
  staleRuleText,
  type RemapCounts,
} from './remap.js';
import {
  colourCount,
  compactFrames,
  POINT_MARK,
  snappedColours,
  SNAPPED_TOP,
  type RemapReport,
  type SnappedColour,
} from './review.js';
import { SourceReader } from './source.js';
import { applyFixes, checkReserved, despeckle, outline, snap } from './steps.js';

/**
 * The `tiles` kind (docs/design/art-pipeline.md, "Kinds"): a tiles recipe
 * lists pieces, not animations, and builds the tile sheet of
 * docs/design/sprites.md "Tiles". The steps are the props' (read, fixes,
 * remap, the reserved-colour check, the snap, the outline by role, despeckle
 * where asked) with no placement: a piece's source is already the piece's
 * exact size, and nothing is scaled or shifted. The outline is drawn only
 * against transparency inside the piece, since a piece's border is where it
 * meets the next. Door frames are packed whole. The review adds `rooms.png`,
 * every template of the set's rule drawn from the built pieces with `tileAt`:
 * the rooms of rooms.json for a cave set, the holding's layouts for a shore
 * set. A recipe declares its set (`rule`, `doors`, M2 Task 3c): the pieces it
 * must carry, the opacity each keeps and whether it has door animations all
 * follow from it (`tileRecipePiecesFor`, `tileFramesFor`).
 */

/** One built frame of a tile sheet: a static piece, or one frame of a door animation. */
export interface BuiltTile {
  name: string;
  /** The piece, or the door animation, this frame belongs to. */
  piece: string;
  n: number;
  source: string;
  img: Img;
  offPalette: number;
  maxDeltaE: number;
  moved: Map<string, { to: string; dE: number; pixels: number }>;
  outlineGaps: number;
  interiorDreamNight: number;
  despeckled: number | null;
  /** How much of the piece must be opaque (tiles.ts `TileOpacity`). */
  opacity: TileOpacity;
  /** Transparent pixels where the piece must be opaque (everywhere, or its top row): how many, and the first. */
  holes: { count: number; first: [number, number] } | null;
}

/** What building a tiles recipe gives: its frames, the remap counts, the report and every output's bytes. */
export interface TileBuildResult {
  recipe: Recipe;
  tiles: BuiltTile[];
  remapCounts: RemapCounts;
  report: TileReport;
  /** Repo-relative path → file bytes, everything this recipe writes. */
  outputs: Map<string, Buffer>;
}

/** The widest row the tile sheet packs, in px: eight tiles. */
export const TILE_ROW_W = 256;
/** contact.png's scale. */
const SCALE = 2;
const GAP = 4;
/** The space round and between the rooms in rooms.png, in px (1×). */
export const ROOM_GAP = 16;

/**
 * What rooms.png draws for a set: the templates its rule draws. A cave set
 * draws every room of rooms.json (a doorless cave set only those without a
 * door); a shore set draws the holding's layouts (holding.json, M2 Task 3b),
 * which the engine draws with the shore rule.
 */
export function reviewTemplatesFor(set: TileSetSpec): readonly TileTemplate[] {
  if (set.rule === 'shore') return holdingData.layouts.map((l) => holdingTemplate(l));
  return set.doors ? roomTemplates : roomTemplates.filter((t) => doorlessProblems(t).length === 0);
}

/** What rooms.png draws for the default set, a cave with doors: every room of rooms.json. */
export const REVIEW_TEMPLATES: readonly TileTemplate[] = reviewTemplatesFor({ rule: 'cave', doors: true });

/** Steps 1–7 and 9 per frame, for every piece of a tiles recipe, in the contract's order. */
export function buildTileFrames(
  recipe: Recipe,
  root: string,
): { tiles: BuiltTile[]; remapCounts: RemapCounts } {
  const reader = new SourceReader(root);
  const file = `art/sheets/${recipe.sheet}.json`;
  const remapCounts: RemapCounts = recipe.remap.map(() => new Map<string, number>());
  const fixes = new Map<string, [number, number, string | null][]>();
  for (const f of recipe.fixes) fixes.set(f.frame, [...(fixes.get(f.frame) ?? []), ...f.pixels]);
  const pieces = recipe.tiles?.pieces ?? {};
  const tiles: BuiltTile[] = [];
  const sizes: string[] = [];
  for (const piece of tileRecipePiecesFor(recipeTileSet(recipe))) {
    const source = pieces[piece.name];
    if (!source) continue;
    source.frames.forEach((index, n) => {
      const name = tileFrameName(piece.name, n);
      // 1. read (alpha) and 2. select; a piece is never scaled, mirrored or placed.
      let img = reader.read(source.src, index, undefined, name);
      if (img.w !== piece.w || img.h !== piece.h) {
        sizes.push(
          `${name} (${source.src} frame ${index}): the source is ${img.w}×${img.h}, but ${piece.name} is ` +
            `${piece.w}×${piece.h}; a piece's source must be its exact size (nothing is scaled or shifted)`,
        );
        return;
      }
      // 3. fixes, 4. remap.
      img = applyFixes(img, fixes.get(name) ?? [], name);
      const ref = { name, anim: piece.name, facing: null };
      const remapped = applyRemap(img, recipe.remap, ref, file);
      img = remapped.img;
      recipe.remap.forEach((rule, i) => {
        const counts = remapCounts[i];
        if (counts && appliesTo(rule, ref))
          counts.set(piece.name, (counts.get(piece.name) ?? 0) + (remapped.taken[i] ?? 0));
      });
      // 5. reserved colours, 6. snap, 7. outline against the piece's own transparency only.
      checkReserved(img, name);
      const snapped = snap(img, name);
      const outlined = outline(snapped.img, recipe.outline, { border: false });
      // 9. despeckle, where the piece asks.
      let out = outlined.img;
      let despeckled: number | null = null;
      if (source.despeckle) {
        const d = despeckle(out);
        out = d.img;
        despeckled = d.changed;
      }
      let holes: BuiltTile['holes'] = null;
      if (piece.opacity !== 'none') {
        // Every row for a fully opaque piece; the top row alone for one opaque at the top (a drop).
        const rows = piece.opacity === 'full' ? out.h : 1;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < out.w; x++) {
            if (opaqueAt(out, x, y)) continue;
            holes ??= { count: 0, first: [x, y] };
            holes.count++;
          }
        }
      }
      tiles.push({
        name,
        piece: piece.name,
        n,
        source: `${source.src} ${index}`,
        img: out,
        offPalette: snapped.offPalette,
        maxDeltaE: snapped.maxDeltaE,
        moved: snapped.moved,
        outlineGaps: outlined.gaps,
        interiorDreamNight: outlined.interiorDreamNight,
        despeckled,
        opacity: piece.opacity,
        holes,
      });
    });
  }
  if (sizes.length) throw new PipelineError(sizes);
  return { tiles, remapCounts };
}

/** The pieces and door frames a recipe of a set lacks against the contract, for a draft's report (by piece). */
export function missingTiles(tiles: readonly BuiltTile[], set: TileSetSpec): string[] {
  const built = new Map<string, number>();
  for (const t of tiles) built.set(t.piece, (built.get(t.piece) ?? 0) + 1);
  return tileRecipePiecesFor(set).flatMap((p) => {
    const n = built.get(p.name);
    if (n === undefined) return [p.name];
    return n < p.frames ? [`${p.name}: ${n} of ${p.frames} frames`] : [];
  });
}

/** What a finished tile sheet is missing, as failures: every piece of its rule and, with doors, every door frame. */
export function tileCompletenessProblems(recipe: Recipe, tiles: readonly BuiltTile[]): string[] {
  const built = new Map<string, number>();
  for (const t of tiles) built.set(t.piece, (built.get(t.piece) ?? 0) + 1);
  const set = recipeTileSet(recipe);
  return tileRecipePiecesFor(set).flatMap((p) => {
    const n = built.get(p.name);
    if (n === undefined)
      return [
        `${recipe.sheet}: ${p.name} is missing (a finished tile sheet carries every piece of its rule${set.doors ? ' and every door frame' : ''})`,
      ];
    return n !== p.frames ? [`${recipe.sheet}: ${p.name} has ${n} frames; the contract says ${p.frames}`] : [];
  });
}

/** The opacity rule as messages: floors, faces, tops and door frames are fully opaque; drops are opaque in their top row. */
export function opacityProblems(recipe: Recipe, tiles: readonly BuiltTile[]): string[] {
  return tiles.flatMap((t) =>
    t.holes
      ? [
          t.opacity === 'top'
            ? `${recipe.sheet}: ${t.name} has ${t.holes.count} transparent pixels in its top row, the first at (${t.holes.first.join(', ')}); ` +
              'a drop is opaque at the top, where it meets the floor above (its dither below may be transparent)'
            : `${recipe.sheet}: ${t.name} has ${t.holes.count} transparent pixels, the first at (${t.holes.first.join(', ')}); ` +
              'floor, face, top and door pieces are fully opaque',
        ]
      : [],
  );
}

/** Shelf packing in the contract's order: left to right in rows of at most `TILE_ROW_W`, each as tall as its tallest frame; doors stay whole. */
export function packTiles(
  tiles: readonly BuiltTile[],
  set: TileSetSpec,
): {
  sheet: Img;
  rects: Map<string, { x: number; y: number; w: number; h: number }>;
} {
  const order = new Map(tileFramesFor(set).map((f, i) => [f.name, i]));
  const sorted = [...tiles].sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  const rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const t of sorted) {
    if (x + t.img.w > TILE_ROW_W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    rects.set(t.name, { x, y, w: t.img.w, h: t.img.h });
    x += t.img.w;
    rowH = Math.max(rowH, t.img.h);
  }
  const sheet = blank(TILE_ROW_W, Math.max(TILE_WORLD_PX, y + rowH));
  for (const t of sorted) {
    const r = rects.get(t.name);
    if (r) blit(sheet, t.img, r.x, r.y);
  }
  return { sheet, rects };
}

/** The tile sheet's JSON (sprites.md "Tiles"): named frames, the door anims (with doors), and the `tiles` block, keys in a fixed order. */
export function tileSheetJson(
  recipe: Recipe,
  size: { w: number; h: number },
  rects: ReadonlyMap<string, { x: number; y: number; w: number; h: number }>,
): string {
  const set = recipeTileSet(recipe);
  const frames: Record<string, unknown> = {};
  for (const f of tileFramesFor(set)) {
    const r = rects.get(f.name);
    if (!r) continue;
    frames[f.name] = {
      frame: r,
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h },
      sourceSize: { w: r.w, h: r.h },
      anchor: { x: 0, y: 0 },
    };
  }
  const meta = {
    image: `${recipe.sheet}.png`,
    size,
    scale: '1',
    format: 'RGBA8888',
    app: APP_ID,
    version: '2',
    pixelScale: 1,
  };
  const anims: Record<string, unknown> = {};
  for (const row of tileDoorAnimsFor(set)) {
    const names = Array.from({ length: row.frames }, (_, n) => `${row.name}_${n}`);
    if (!names.every((n) => rects.has(n))) continue;
    anims[row.name] = { frames: names, frameRate: row.fps, repeat: 0, hold: true };
  }
  return `${JSON.stringify({ frames, meta, anims, tiles: tilesBlock(recipe) }, null, 2)}\n`;
}

/**
 * The sheet's `tiles` block (sprites.md "Tiles"): the tile size, `floorWeights`,
 * the mid weights the recipe gives, and its `rule` and `doors` when they are
 * not the defaults (cave, true), so a cave set's block reads as before.
 */
export function tilesBlock(recipe: Recipe): TileSheetTiles {
  const out: TileSheetTiles = { tileSize: TILE_WORLD_PX, floorWeights: recipe.tiles?.floorWeights ?? [] };
  const set = recipeTileSet(recipe);
  if (set.rule !== 'cave') out.rule = set.rule;
  if (!set.doors) out.doors = false;
  if (recipe.tiles?.faceMidWeights) out.faceMidWeights = recipe.tiles.faceMidWeights;
  if (recipe.tiles?.topMidWeights) out.topMidWeights = recipe.tiles.topMidWeights;
  if (recipe.tiles?.dropMidWeights) out.dropMidWeights = recipe.tiles.dropMidWeights;
  return out;
}

/** The static pieces' rows of contact.png: floors, shades, faces, tops, corners (cave); floors, drops, lips (shore). */
const CONTACT_GROUPS = ['floor_', 'shade_', 'face_', 'top_', 'corner_', 'drop_', 'lip_'];

/**
 * contact.png: every built piece at 2× on the floor (left panel) and on the
 * wall face (right panel): a row each for the floors, shades, faces, tops and
 * corners (a shore set: floors, drops, lips), then a row per door animation,
 * its frames in order.
 */
export function renderTileContact(tiles: readonly BuiltTile[], set: TileSetSpec): Img {
  const order = new Map(tileFramesFor(set).map((f, i) => [f.name, i]));
  const sorted = [...tiles].sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  const rows: BuiltTile[][] = [
    ...CONTACT_GROUPS.map((g) => sorted.filter((t) => t.piece.startsWith(g))),
    ...tileDoorAnimsFor(set).map((a) => sorted.filter((t) => t.piece === a.name)),
  ].filter((r) => r.length > 0);
  const rowW = (r: readonly BuiltTile[]) => r.reduce((s, t) => s + t.img.w * SCALE + GAP, GAP);
  const panelW = Math.max(GAP * 2, ...rows.map(rowW));
  const rowH = (r: readonly BuiltTile[]) => Math.max(...r.map((t) => t.img.h * SCALE));
  const width = GAP + 2 * (panelW + GAP);
  const height = rows.reduce((s, r) => s + rowH(r) + GAP, GAP);
  const out = blank(width, Math.max(height, GAP * 2));
  fillRect(out, 0, 0, out.w, out.h, HOLLOW_DEEP);
  [FLOOR, WALL].forEach((bg, panel) => {
    let y = GAP;
    for (const r of rows) {
      let x = GAP + panel * (panelW + GAP) + GAP;
      for (const t of r) {
        fillRect(out, x, y, t.img.w * SCALE, t.img.h * SCALE, bg);
        blit(out, t.img, x, y, SCALE);
        x += t.img.w * SCALE + GAP;
      }
      y += rowH(r) + GAP;
    }
  });
  return out;
}

/** A missing piece in a draft's rooms.png: a hollow-deep box with a 1 px telegraph-pink cross corner to corner. */
export function missingBox(out: Img, x0: number, y0: number, w: number, h: number): void {
  fillRect(out, x0, y0, w, h, HOLLOW_DEEP);
  const n = Math.max(w, h);
  for (let i = 0; i < n; i++) {
    const x = Math.floor((i * w) / n);
    const y = Math.floor((i * h) / n);
    for (const [px, py] of [
      [x0 + x, y0 + y],
      [x0 + w - 1 - x, y0 + y],
    ] as const) {
      if (px >= 0 && py >= 0 && px < out.w && py < out.h) setPixel(out, px, py, POINT_MARK);
    }
  }
}

/** One room of rooms.png: where it is drawn and the pieces it needed that the recipe doesn't build. */
export interface RoomReport {
  name: string;
  cols: number;
  rows: number;
  at: [number, number];
  missing: string[];
}

/**
 * rooms.png: every template of the set's rule (`reviewTemplatesFor`: the
 * rooms of rooms.json for a cave set, the holding's layouts for a shore set)
 * drawn with `roomTiles` (the rule the engine uses) from the built pieces, at
 * 1×, doors closed, one under the other on hollow-deep. A piece the recipe
 * doesn't build (a draft) draws as `missingBox`. This is the image ART judges
 * the set by.
 */
export function renderRooms(
  tiles: readonly BuiltTile[],
  weights: TileWeights,
  templates: readonly TileTemplate[] = reviewTemplatesFor(tileSetOfWeights(weights)),
): { img: Img; rooms: RoomReport[] } {
  const byName = new Map(tiles.map((t) => [t.name, t.img]));
  const plans = templates.map((t) => ({ t, ...roomTiles(t, weights) }));
  const source = tileSetOfWeights(weights).rule === 'shore' ? 'holding.json' : 'rooms.json';
  const problems = plans.flatMap((p) => p.problems.map((m) => `${source}: ${m}`));
  if (problems.length) throw new PipelineError(problems);
  const cols = (t: TileTemplate) => t.tiles.reduce((m, r) => Math.max(m, r.length), 0);
  const width = ROOM_GAP * 2 + Math.max(0, ...templates.map((t) => cols(t) * TILE_WORLD_PX));
  const height = templates.reduce((s, t) => s + t.tiles.length * TILE_WORLD_PX + ROOM_GAP, ROOM_GAP);
  const out = blank(width, height);
  fillRect(out, 0, 0, width, height, HOLLOW_DEEP);
  const rooms: RoomReport[] = [];
  let oy = ROOM_GAP;
  for (const { t, draws, doors } of plans) {
    const ox = ROOM_GAP;
    const missing = new Set<string>();
    const draw = (name: string, x: number, y: number, w: number, h: number): void => {
      const img = byName.get(name);
      if (img) blit(out, img, x, y);
      else {
        missingBox(out, x, y, w, h);
        missing.add(name);
      }
    };
    for (const d of draws)
      draw(d.piece, ox + d.col * TILE_WORLD_PX, oy + d.row * TILE_WORLD_PX, TILE_WORLD_PX, TILE_WORLD_PX);
    for (const d of doors) {
      draw(
        doorFrameName(d.piece, 'closed', 0),
        ox + d.col * TILE_WORLD_PX,
        oy + d.row * TILE_WORLD_PX,
        d.cols * TILE_WORLD_PX,
        d.rows * TILE_WORLD_PX,
      );
    }
    const order = new Map(tileFramesFor(tileSetOfWeights(weights)).map((f, i) => [f.name, i]));
    rooms.push({
      name: t.name,
      cols: cols(t),
      rows: t.tiles.length,
      at: [ox, oy],
      missing: [...missing].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
    });
    oy += t.tiles.length * TILE_WORLD_PX + ROOM_GAP;
  }
  return { img: out, rooms };
}

export interface TileFrameReport {
  name: string;
  source: string;
  w: number;
  h: number;
  offPalette: number;
  maxDeltaE: number;
  outlineGaps: number;
  colours: number;
  despeckled?: number;
  /** Transparent pixels in a piece that must be opaque. */
  holes?: number;
}

/** The set a weights block (a sheet's `tiles` block) declares. */
function tileSetOfWeights(weights: TileWeights): TileSetSpec {
  return { rule: weights.rule === 'shore' ? 'shore' : 'cave', doors: weights.doors !== false };
}

/** report.json of a tiles recipe. */
export interface TileReport {
  sheet: string;
  kind: 'tiles';
  outline: string;
  draft: boolean;
  tileSize: number;
  /** The set's rule and doors, as the sheet's `tiles` block carries them: absent means cave, and doors. */
  rule?: string;
  doors?: boolean;
  floorWeights: number[];
  /** The plain-wall weights (cave) or the plain-drop weights (shore), when the recipe gives them (absent: an even pick). */
  faceMidWeights?: number[];
  topMidWeights?: number[];
  dropMidWeights?: number[];
  totals: { frames: number; offPalette: number; maxDeltaE: number; outlineGaps: number; masked?: number };
  /** Pieces and door frames the recipe lacks against the contract (a finished sheet fails on them). */
  missing: string[];
  /** Opaque pieces with holes (a finished sheet fails on them). */
  opacity: string[];
  rooms: RoomReport[];
  remap: RemapReport[];
  staleRemap: string[];
  snappedColours: number;
  snapped: SnappedColour[];
  frames: TileFrameReport[];
  outputs: string[];
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

function tileReport(
  recipe: Recipe,
  tiles: readonly BuiltTile[],
  remapCounts: RemapCounts,
  rooms: RoomReport[],
  outputs: string[],
): TileReport {
  const frames: TileFrameReport[] = tiles.map((t) => {
    const r: TileFrameReport = {
      name: t.name,
      source: t.source,
      w: t.img.w,
      h: t.img.h,
      offPalette: t.offPalette,
      maxDeltaE: round2(t.maxDeltaE),
      outlineGaps: t.outlineGaps,
      colours: colourCount(t.img),
    };
    if (t.despeckled !== null) r.despeckled = t.despeckled;
    if (t.holes) r.holes = t.holes.count;
    return r;
  });
  const snapped = snappedColours(tiles);
  return {
    sheet: recipe.sheet,
    kind: 'tiles',
    outline: recipe.outline,
    draft: recipe.draft,
    ...tilesBlock(recipe),
    totals: {
      frames: frames.length,
      offPalette: frames.reduce((s, f) => s + f.offPalette, 0),
      maxDeltaE: Math.max(0, ...frames.map((f) => f.maxDeltaE)),
      outlineGaps: frames.reduce((s, f) => s + f.outlineGaps, 0),
    },
    missing: missingTiles(tiles, recipeTileSet(recipe)),
    opacity: opacityProblems(recipe, tiles),
    rooms,
    remap: recipe.remap.map((rule, i) => {
      const counts = remapCounts[i] ?? new Map<string, number>();
      const total = [...counts.values()].reduce((s, n) => s + n, 0);
      return { rule: i, maps: ruleMaps(rule), scope: ruleScope(rule), pixels: Object.fromEntries(counts), total, stale: total === 0 };
    }),
    staleRemap: staleRules(remapCounts).map((i) => staleRuleText(recipe.sheet, i, recipe.remap[i])),
    snappedColours: snapped.length,
    snapped: snapped.slice(0, SNAPPED_TOP),
    frames,
    outputs: [...outputs].sort(),
  };
}

function tileMarkdown(r: TileReport): string {
  const lines: string[] = [];
  const list = (xs: string[]): string => (xs.length ? xs.join(', ') : 'none');
  const draftNote = (n: number): string =>
    n && r.draft ? ' (reported because this is a draft; a finished sheet fails on them)' : '';
  const shore = r.rule === 'shore';
  const doors = r.doors !== false;
  lines.push(`# ${r.sheet}${r.draft ? ' (draft)' : ''}`, '');
  lines.push(
    `Built by \`pnpm art:build ${r.sheet}\` from \`art/sheets/${r.sheet}.json\`; do not edit by hand (\`pnpm art:check\` rebuilds it).`,
    `Kind tiles, the ${shore ? 'shore' : 'cave'} rule${doors ? ' with doors' : ', no doors'}, outline ${r.outline}, ${r.tileSize}×${r.tileSize} tiles, floor weights ${r.floorWeights.join(':')} (floor_0 to floor_3), ` +
      (shore
        ? `plain drop ${(r.dropMidWeights ?? [1, 1]).join(':')} (drop_mid_0 to drop_mid_1).`
        : `plain face ${(r.faceMidWeights ?? [1, 1]).join(':')} and plain top ${(r.topMidWeights ?? [1, 1]).join(':')} (mid_0 to mid_1).`) +
      (r.draft ? ' A draft writes this review only, never `packages/shared/assets`.' : ''),
    '',
  );
  lines.push('## Summary', '');
  lines.push(`- Frames: ${r.totals.frames} (static pieces${doors ? ' and door frames' : ''}).`);
  lines.push(`- Off-palette pixels snapped: ${r.totals.offPalette} (largest ΔE ${r.totals.maxDeltaE}).`);
  lines.push(
    `- Outline gaps (edge pixels against the piece's own transparency, not in an outline colour; the border is no edge): ${r.totals.outlineGaps}.`,
  );
  lines.push(`- Missing against the contract: ${list(r.missing)}${draftNote(r.missing.length)}.`);
  lines.push(`- Opaque pieces with transparent pixels: ${r.opacity.length}${draftNote(r.opacity.length)}.`);
  if (r.remap.length) {
    const stale = r.remap.filter((x) => x.stale).map((x) => `remap[${x.rule}]`);
    lines.push(
      `- Remap rules: ${r.remap.length}; stale (match no pixel in any frame they apply to): ${list(stale)}${draftNote(stale.length)}.`,
    );
  }
  lines.push('');
  lines.push('## Review images', '');
  lines.push(
    `\`contact.png\` has every built piece at 2× on the floor (left) and the wall face (right): a row each for the ${shore ? 'floors, drops and lips' : 'floors, shades, faces, tops and corners'}${doors ? ', then a row per door animation' : ''}.`,
    '',
    `\`rooms.png\` draws ${shore ? "the holding's layouts (holding.json)" : 'every room of rooms.json' + (doors ? '' : ' without a door')} from these pieces with the engine's ${shore ? 'shore' : 'cave'} rule (\`tileAt\`, sprites.md "Tiles"), at 1×${doors ? ', doors closed' : ''}, top to bottom` +
      (r.missing.length ? '; a piece this recipe lacks draws as a hollow-deep box with a telegraph-pink cross' : '') +
      ':',
    '',
    '| Room | Cells | At (px) | Pieces it needs that are missing |',
    '|---|---|---|---|',
  );
  for (const room of r.rooms)
    lines.push(`| ${room.name} | ${room.cols}×${room.rows} | ${room.at.join(', ')} | ${list(room.missing)} |`);
  lines.push('', '## Pieces', '');
  const despeckle = r.frames.some((f) => f.despeckled !== undefined);
  lines.push(
    `| Frame | Source | Size | Off-palette | Max ΔE | Outline gaps | Colours | Holes |${despeckle ? ' Despeckled |' : ''}`,
    `|---|---|---|---|---|---|---|---|${despeckle ? '---|' : ''}`,
  );
  for (const f of r.frames) {
    const cells = [
      f.name,
      `\`${f.source}\``,
      `${f.w}×${f.h}`,
      f.offPalette,
      f.maxDeltaE,
      f.outlineGaps,
      f.colours,
      f.holes === undefined ? '' : `${f.holes} **opaque piece**`,
    ];
    if (despeckle) cells.push(f.despeckled ?? '');
    lines.push(`| ${cells.join(' | ')} |`);
  }
  if (r.remap.length) {
    lines.push('', '## Remap', '');
    lines.push(
      "Each rule of the recipe's `remap`, in order, and the pixels it took per piece it applies to (a pixel takes the first rule that matches it).",
      '',
      '| Rule | Maps | Scope | Pixels per piece | Total |',
      '|---|---|---|---|---|',
    );
    for (const x of r.remap) {
      const per = Object.entries(x.pixels)
        .map(([piece, n]) => `${piece} ${n}`)
        .join(', ');
      lines.push(`| ${x.rule} | ${x.maps} | ${x.scope} | ${per} | ${x.total}${x.stale ? ' **stale**' : ''} |`);
    }
  }
  lines.push('', '## Off-palette colours the snap moved', '');
  lines.push(
    `${r.snappedColours} source colours reached the snap off the whitelist${r.remap.length ? ' (after `remap`)' : ''}. ` +
      `The ${Math.min(SNAPPED_TOP, r.snappedColours)} with the most pixels, with the colour the snap sent each to and that colour's ramp.`,
    '',
  );
  if (r.snapped.length) {
    lines.push('| Colour | Pixels | Snapped to | ΔE | Ramp | Frames |', '|---|---|---|---|---|---|');
    for (const c of r.snapped) {
      lines.push(
        `| ${c.colour} | ${c.pixels} | ${describeHex(c.to)} | ${c.deltaE} | ${c.materials.join(', ')} | ${compactFrames(c.frames)} |`,
      );
    }
  }
  if (r.opacity.length) {
    lines.push('', '## Opaque pieces with holes', '');
    for (const p of r.opacity) lines.push(`- ${p}`);
  }
  if (r.staleRemap.length) {
    lines.push('', '## Stale remap rules', '');
    for (const p of r.staleRemap) lines.push(`- ${p}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Builds a tiles recipe in memory: the pieces, the checks a finished sheet
 * must pass (every piece and door frame, the opacity rule, no stale remap
 * rule), the sheet PNG and JSON (finished only) and the review folder
 * (contact.png, rooms.png, report.md/.json).
 */
export function buildTiles(recipe: Recipe, root: string): TileBuildResult {
  const { tiles, remapCounts } = buildTileFrames(recipe, root);
  if (!recipe.draft) {
    const problems = [
      ...tileCompletenessProblems(recipe, tiles),
      ...opacityProblems(recipe, tiles),
      ...staleRules(remapCounts).map((i) => staleRuleText(recipe.sheet, i, recipe.remap[i])),
    ];
    if (problems.length) throw new PipelineError(problems);
  }
  const set = recipeTileSet(recipe);
  const rooms = renderRooms(tiles, tilesBlock(recipe));
  const outputs = new Map<string, Buffer>();
  if (!recipe.draft) {
    const packed = packTiles(tiles, set);
    const base = `${ASSET_DIR}/${recipe.sheet}`;
    outputs.set(`${base}.png`, encodePng(packed.sheet));
    outputs.set(
      `${base}.json`,
      Buffer.from(tileSheetJson(recipe, { w: packed.sheet.w, h: packed.sheet.h }, packed.rects)),
    );
  }
  const review = `${REVIEW_DIR}/${recipe.sheet}`;
  outputs.set(`${review}/contact.png`, encodePng(renderTileContact(tiles, set)));
  outputs.set(`${review}/rooms.png`, encodePng(rooms.img));
  const report = tileReport(recipe, tiles, remapCounts, rooms.rooms, [
    ...outputs.keys(),
    `${review}/report.md`,
    `${review}/report.json`,
  ]);
  outputs.set(`${review}/report.md`, Buffer.from(tileMarkdown(report)));
  outputs.set(`${review}/report.json`, Buffer.from(`${JSON.stringify(report, null, 2)}\n`));
  return { recipe, tiles, remapCounts, report, outputs };
}
