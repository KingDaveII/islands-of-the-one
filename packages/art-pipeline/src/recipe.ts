import { existsSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  isFloorWeights,
  isMidWeights,
  isKindledPoint,
  KINDLED_POINT_ANIMS,
  KINDLED_POINTS,
  spritePointsFor,
  TILE_RECIPE_PIECES,
  type KindledPoint,
  type PropAnimGiven,
  type SpriteAnimSpec,
} from '@iot/shared';
import {
  animKey,
  animNames,
  recipeRatedAnims,
  sheetTable,
  type PropGiven,
  facingsFor,
  frameName,
  hasFacings,
  KINDS,
  kindOfName,
  type Facing,
  type Kind,
} from './contract.js';
import { TELEGRAPH, WHITELIST } from './colour.js';
import { PipelineError } from './errors.js';
import { parseRemap, type FrameRef, type RemapRule } from './remap.js';

/**
 * A recipe (art/sheets/<sheet>.json), written by ART: which raw frames make
 * which animation, and the few fixes that take taste. The guard below accepts
 * exactly the documented shape (docs/design/art-pipeline.md): unknown keys,
 * wrong types and missing files all fail with a message naming the field.
 */

export type Ground = 'frame' | 'canvas' | { ref: number };

export interface FrameSource {
  /** Repo-relative: a folder of frame-<n>.png, one PNG, or a GIF, under art/. */
  src: string;
  /** Source frame indices, in order. */
  frames: number[];
  /** Reduce a ×k delivery by k (every k×k block must be one colour). */
  downscale?: number;
  /**
   * Mirror every frame left to right as it is read (step 1), before everything
   * else: fixes, remap and skin coordinates, ground refs and the face box all
   * refer to the mirrored frame.
   */
  flipX?: boolean;
}

export interface RecipeAnim {
  ground?: Ground;
  despeckle?: boolean;
  /** Kinds with facings (kindled, npc). */
  facings?: Partial<Record<Facing, FrameSource>>;
  /** Kinds without facings (husk, prop): the source sits on the animation itself. */
  source?: FrameSource;
  /** Props only, on the animations the recipe rates (`idle`, the chest's `closed`): the frame rate (default 8). */
  fps?: number;
}

/** One piece of a tiles recipe: its source (one frame for a static piece, the door's frames in order) and despeckle. */
export interface TileSource extends FrameSource {
  despeckle?: boolean;
}

/** What a tiles recipe (kind `tiles`) has in place of `anims`: the weights and the pieces, by name. */
export interface TilesRecipe {
  /** The weights of floor_0 … floor_3, four positive integers, written to the sheet's `tiles` block. */
  floorWeights: number[];
  /** The weights of face_mid_0 and face_mid_1, two positive integers, written to the sheet when given (absent: an even pick). */
  faceMidWeights?: number[];
  /** The same for top_mid_0 and top_mid_1. */
  topMidWeights?: number[];
  pieces: Record<string, TileSource>;
}

/** A pixel `[x, y]` or a rectangle `[[x0, y0], [x1, y1]]` (both corners included), in the source frame's pixels. */
export type Area = [number, number] | [[number, number], [number, number]];

export interface Recipe {
  sheet: string;
  kind: Kind;
  outline: 'player' | 'other';
  draft: boolean;
  notes?: string;
  anims: Record<string, RecipeAnim>;
  fixes: { frame: string; pixels: [number, number, string | null][] }[];
  skin: { add: Record<string, Area[]>; remove: Record<string, Area[]> };
  /** Colour rules applied before the snap (step 4), in order. */
  remap: RemapRule[];
  /**
   * Named points (sprites.md §5), by point name, then by output frame name: `[x, y]` in that
   * frame's source pixels (after any downscale and `flipX`), like `fixes`. The pipeline places
   * each with its frame; a `flipX` facing inherits its unmirrored twin's points, mirrored.
   */
  points: Partial<Record<KindledPoint, Record<string, [number, number]>>>;
  /** Tiles only (kind `tiles`): its `floorWeights` and `pieces`; `anims` is empty. */
  tiles?: TilesRecipe;
}

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: Json): v is number => typeof v === 'number' && Number.isInteger(v);
const isPoint = (v: Json): v is [number, number] =>
  Array.isArray(v) && v.length === 2 && v.every((n) => isInt(n) && n >= 0);
const isArea = (v: Json): v is Area =>
  isPoint(v) || (Array.isArray(v) && v.length === 2 && v.every((p) => isPoint(p)));

/** A tile piece's frame name: the piece's own name for a static piece, `<anim>_<n>` for a door's animation. */
export function tileFrameName(piece: string, n: number): string {
  return piece.startsWith('door_') ? `${piece}_${n}` : piece;
}

/** Every frame a recipe produces, with its animation (a tiles recipe: its piece) and facing, in no particular order. */
export function recipeFrames(recipe: Pick<Recipe, 'kind' | 'anims' | 'tiles'>): FrameRef[] {
  const out: FrameRef[] = [];
  for (const [piece, s] of Object.entries(recipe.tiles?.pieces ?? {})) {
    s.frames.forEach((_, n) => out.push({ name: tileFrameName(piece, n), anim: piece, facing: null }));
  }
  for (const [anim, a] of Object.entries(recipe.anims)) {
    for (const [facing, s] of animSources(recipe.kind, a)) {
      s.frames.forEach((_, n) => out.push({ name: frameName(anim, facing, n), anim, facing }));
    }
  }
  return out;
}

/** The frame names a recipe produces, in no particular order. */
export function recipeFrameNames(recipe: Pick<Recipe, 'kind' | 'anims' | 'tiles'>): Set<string> {
  return new Set(recipeFrames(recipe).map((f) => f.name));
}

/** An animation's sources as [facing, source] pairs (facing null for kinds without facings). */
export function animSources(kind: Kind, anim: RecipeAnim): [Facing | null, FrameSource][] {
  if (!hasFacings(kind)) return anim.source ? [[null, anim.source]] : [];
  return Object.entries(anim.facings ?? {}).map(([f, s]) => [f as Facing, s]);
}

/**
 * Checks a parsed recipe against the documented shape and the files on disk
 * (`root` is the repo root) and returns it typed, or throws a PipelineError
 * listing every problem. `file` is the recipe's repo-relative path, for messages.
 */
export function parseRecipe(json: Json, file: string, root: string): Recipe {
  const problems: string[] = [];
  const bad = (path: string, msg: string): void => {
    problems.push(`${file}: ${path} ${msg}`);
  };
  const unknownKeys = (path: string, v: Record<string, Json>, allowed: readonly string[]): void => {
    for (const k of Object.keys(v))
      if (!allowed.includes(k)) bad(path ? `${path}.${k}` : k, 'is not a recipe field');
  };

  if (!isObj(json)) throw new PipelineError(`${file}: a recipe is a JSON object`);
  const sheet = json.sheet;
  const expected = basename(file, '.json');
  // A tiles recipe lists pieces, not animations (docs/design/art-pipeline.md, "Kinds").
  const tilesRecipe =
    json.kind === 'tiles' || (typeof sheet === 'string' && kindOfName(sheet) === 'tiles');
  unknownKeys('', json, [
    'sheet',
    'kind',
    'outline',
    'draft',
    'notes',
    ...(tilesRecipe ? ['floorWeights', 'faceMidWeights', 'topMidWeights', 'pieces'] : ['anims', 'skin', 'points']),
    'fixes',
    'remap',
  ]);

  if (typeof sheet !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(sheet))
    bad('sheet', 'must be a lowercase name like "kindled-ash"');
  else if (sheet !== expected) bad('sheet', `is "${sheet}" but the file is ${expected}.json`);

  const kind = json.kind;
  const named = typeof sheet === 'string' ? kindOfName(sheet) : null;
  if (typeof sheet === 'string' && !named) {
    bad(
      'sheet',
      `"${sheet}" has no known kind: a sheet name starts with ${KINDS.map((k) => `${k}-`).join(', ')}`,
    );
  }
  let kindOk = typeof kind === 'string' && (KINDS as readonly string[]).includes(kind);
  if (!kindOk) bad('kind', `must be one of ${KINDS.join(', ')}`);
  else if (!named) kindOk = false;
  else if (kind !== named) {
    bad('kind', `is ${String(kind)} but the name "${String(sheet)}" makes it ${named}`);
    kindOk = false;
  }

  const outline = json.outline;
  if (outline !== 'player' && outline !== 'other') bad('outline', 'must be "player" or "other"');
  else if (outline === 'player' && kindOk && kind !== 'kindled')
    bad('outline', 'is "player" but only Kindled sheets use the player outline');

  if (typeof json.draft !== 'boolean') bad('draft', 'must be true or false');
  if (json.notes !== undefined && typeof json.notes !== 'string') bad('notes', 'must be a string');

  const anims: Record<string, RecipeAnim> = {};
  const tiles = tilesRecipe ? parseTiles(json, root, bad) : undefined;
  if (tilesRecipe) {
    // Pieces in place of animations: parseTiles above.
  } else if (!isObj(json.anims) || Object.keys(json.anims).length === 0)
    bad('anims', 'must be an object with at least one animation');
  else if (kindOk && typeof sheet === 'string') {
    const k = kind as Kind;
    const names = animNames(sheet);
    for (const [name, a] of Object.entries(json.anims)) {
      const path = `anims.${name}`;
      if (!/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(name)) {
        bad(path, 'is not an animation name (lowercase words joined by _)');
        continue;
      }
      if (names && !names.includes(name)) {
        bad(path, `is not in the ${k} animation table (${names.join(', ')})`);
        continue;
      }
      if (!isObj(a)) {
        bad(path, 'must be an object');
        continue;
      }
      const out: RecipeAnim = {};
      const ground = parseGround(a.ground, `${path}.ground`, bad);
      if (ground !== undefined) out.ground = ground;
      if (a.despeckle !== undefined) {
        if (typeof a.despeckle !== 'boolean') bad(`${path}.despeckle`, 'must be true or false');
        else out.despeckle = a.despeckle;
      }
      if (a.fps !== undefined) {
        const rated = recipeRatedAnims(sheet);
        if (k !== 'prop')
          bad(`${path}.fps`, 'is only for props (every other kind takes its rate from the table)');
        else if (!rated.includes(name))
          bad(
            `${path}.fps`,
            `is only for ${rated.join(', ')} (${name} takes its rate from the ${k} animation table)`,
          );
        else if (typeof a.fps !== 'number' || !Number.isInteger(a.fps) || a.fps < 0)
          bad(`${path}.fps`, 'must be a whole number, 0 or more');
        else out.fps = a.fps;
      }
      if (hasFacings(k)) {
        unknownKeys(path, a, ['ground', 'despeckle', 'facings']);
        if (!isObj(a.facings) || Object.keys(a.facings).length === 0) {
          bad(`${path}.facings`, 'must be an object with at least one facing');
        } else {
          const allowed = facingsFor(sheet, name);
          const facings: Partial<Record<Facing, FrameSource>> = {};
          for (const [f, s] of Object.entries(a.facings)) {
            if (!(allowed as readonly string[]).includes(f)) {
              bad(`${path}.facings.${f}`, `is not a facing of ${name} (${allowed.join(', ')})`);
              continue;
            }
            const src = parseSource(s, `${path}.facings.${f}`, root, ground, bad, unknownKeys);
            if (src) facings[f as Facing] = src;
          }
          out.facings = facings;
        }
      } else {
        unknownKeys(path, a, [
          'ground',
          'despeckle',
          'src',
          'frames',
          'downscale',
          'flipX',
          ...(k === 'prop' ? ['fps'] : []),
        ]);
        const own = { src: a.src, frames: a.frames, downscale: a.downscale, flipX: a.flipX };
        const src = parseSource(own, path, root, ground, bad, () => undefined);
        if (src) out.source = src;
      }
      anims[name] = out;
    }
  }

  const partial: Recipe = {
    sheet: typeof sheet === 'string' ? sheet : expected,
    kind: (kindOk ? kind : (named ?? 'prop')) as Kind,
    outline: outline === 'player' ? 'player' : 'other',
    draft: json.draft === true,
    anims,
    fixes: [],
    skin: { add: {}, remove: {} },
    remap: [],
    points: {},
  };
  if (tiles) partial.tiles = tiles;
  if (typeof json.notes === 'string') partial.notes = json.notes;
  const frames = recipeFrameNames(partial);
  const unknownFrame = (path: string, name: Json): boolean => {
    if (typeof name !== 'string' || !frames.has(name)) {
      bad(path, `names ${JSON.stringify(name)}, which is not a frame this recipe builds`);
      return true;
    }
    return false;
  };

  if (json.fixes !== undefined) {
    if (!Array.isArray(json.fixes)) bad('fixes', 'must be a list');
    else {
      json.fixes.forEach((fix: Json, i) => {
        const path = `fixes[${i}]`;
        if (!isObj(fix)) {
          bad(path, 'must be an object');
          return;
        }
        unknownKeys(path, fix, ['frame', 'pixels']);
        if (unknownFrame(`${path}.frame`, fix.frame)) return;
        if (!Array.isArray(fix.pixels) || fix.pixels.length === 0) {
          bad(`${path}.pixels`, 'must be a non-empty list');
          return;
        }
        const telegraph = typeof fix.frame === 'string' && fix.frame.startsWith('telegraph');
        const pixels: [number, number, string | null][] = [];
        fix.pixels.forEach((p: Json, j) => {
          const pp = `${path}.pixels[${j}]`;
          if (
            !Array.isArray(p) ||
            p.length !== 3 ||
            !isInt(p[0]) ||
            !isInt(p[1]) ||
            p[0] < 0 ||
            p[1] < 0
          ) {
            bad(pp, 'must be [x, y, "#rrggbb"] or [x, y, null]');
            return;
          }
          const c: Json = p[2];
          if (c === null) {
            pixels.push([p[0], p[1], null]);
            return;
          }
          if (typeof c !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c)) {
            bad(pp, 'must set a "#rrggbb" colour or null');
            return;
          }
          const hex = c.toLowerCase();
          if (!WHITELIST.includes(hex) && !(telegraph && TELEGRAPH.includes(hex))) {
            bad(
              pp,
              `sets ${hex}, which is not a whitelist colour${telegraph ? ' or a telegraph colour' : ''}`,
            );
            return;
          }
          pixels.push([p[0], p[1], hex]);
        });
        partial.fixes.push({ frame: fix.frame as string, pixels });
      });
    }
  }

  if (json.remap !== undefined) {
    partial.remap = parseRemap(json.remap, recipeFrames(partial), hasFacings(partial.kind), bad);
  }

  if (json.skin !== undefined) {
    if (partial.kind !== 'kindled')
      bad('skin', 'is only for Kindled sheets (the only ones with a skin mask)');
    else if (!isObj(json.skin)) bad('skin', 'must be an object with "add" and/or "remove"');
    else {
      unknownKeys('skin', json.skin, ['add', 'remove']);
      for (const which of ['add', 'remove'] as const) {
        const block = json.skin[which];
        if (block === undefined) continue;
        if (!isObj(block)) {
          bad(`skin.${which}`, 'must map frame names to lists of pixels or rectangles');
          continue;
        }
        for (const [name, areas] of Object.entries(block)) {
          const path = `skin.${which}.${name}`;
          if (unknownFrame(path, name)) continue;
          if (!Array.isArray(areas) || areas.length === 0 || !areas.every(isArea)) {
            bad(
              path,
              'must be a non-empty list of [x, y] pixels or [[x0, y0], [x1, y1]] rectangles',
            );
            continue;
          }
          partial.skin[which][name] = areas;
        }
      }
    }
  }

  if (json.points !== undefined) {
    const animOf = new Map(recipeFrames(partial).map((f) => [f.name, f.anim]));
    if (!isObj(json.points))
      bad('points', 'must map point names to frames: { "tip": { "<frame>": [x, y] } }');
    else {
      for (const [point, block] of Object.entries(json.points)) {
        const path = `points.${point}`;
        if (!isKindledPoint(point)) {
          bad(path, `is not a point name (${KINDLED_POINTS.join(', ')})`);
          continue;
        }
        if (!isObj(block)) {
          bad(path, 'must map output frame names to [x, y]');
          continue;
        }
        const out: Record<string, [number, number]> = {};
        for (const [name, at] of Object.entries(block)) {
          const pp = `${path}.${name}`;
          if (unknownFrame(pp, name)) continue;
          const anim = animOf.get(name) ?? '';
          if (!spritePointsFor(partial.sheet, anim).includes(point)) {
            bad(
              pp,
              `is on ${anim}, which carries no ${point} point (${point} goes on ${KINDLED_POINT_ANIMS[point].join(', ')}` +
                `${partial.kind === 'kindled' ? '' : ', Kindled sheets only'})`,
            );
            continue;
          }
          if (!isPoint(at)) {
            bad(pp, "must be [x, y], whole pixels in the frame's source");
            continue;
          }
          out[name] = [at[0], at[1]];
        }
        partial.points[point] = out;
      }
    }
  }

  if (problems.length) throw new PipelineError(problems);
  return partial;
}

/**
 * A tiles recipe's `floorWeights`, its optional `faceMidWeights` and
 * `topMidWeights` (two positive integers each) and `pieces`: every piece
 * named in the contract (`TILE_RECIPE_PIECES`), with a `src`, its `frames` (a
 * static piece one, default [0]; a door animation its frames in order, at
 * most the contract's count) and an optional `despeckle`. Nothing is scaled
 * or mirrored, so `downscale` and `flipX` are not piece fields.
 */
function parseTiles(
  json: Record<string, Json>,
  root: string,
  bad: (p: string, m: string) => void,
): TilesRecipe {
  const out: TilesRecipe = { floorWeights: [], pieces: {} };
  if (!isFloorWeights(json.floorWeights))
    bad('floorWeights', 'must be four positive integers (the weights of floor_0 … floor_3)');
  else out.floorWeights = [...json.floorWeights];
  for (const k of ['faceMidWeights', 'topMidWeights'] as const) {
    const v = json[k];
    if (v === undefined) continue;
    const piece = k === 'faceMidWeights' ? 'face_mid' : 'top_mid';
    if (!isMidWeights(v)) bad(k, `must be two positive integers (the weights of ${piece}_0 and ${piece}_1)`);
    else out[k] = [...v];
  }
  if (!isObj(json.pieces) || Object.keys(json.pieces).length === 0) {
    bad('pieces', 'must be an object with at least one piece');
    return out;
  }
  for (const [name, v] of Object.entries(json.pieces)) {
    const path = `pieces.${name}`;
    const spec = TILE_RECIPE_PIECES.find((p) => p.name === name);
    if (!spec) {
      bad(path, `is not a tile piece (${TILE_RECIPE_PIECES.map((p) => p.name).join(', ')})`);
      continue;
    }
    if (!isObj(v)) {
      bad(path, 'must be an object with "src" (and "frames" for a door animation)');
      continue;
    }
    for (const k of Object.keys(v))
      if (!['src', 'frames', 'despeckle'].includes(k)) bad(`${path}.${k}`, 'is not a piece field');
    const door = name.startsWith('door_');
    if (v.frames === undefined && door) {
      bad(`${path}.frames`, `must list the ${spec.frames} source frames of ${name}, in order`);
      continue;
    }
    const frames = v.frames ?? [0];
    if (Array.isArray(frames) && frames.length > spec.frames) {
      bad(
        `${path}.frames`,
        spec.frames === 1
          ? `lists ${frames.length} frames; ${name} is one frame`
          : `lists ${frames.length} frames; ${name} has ${spec.frames}`,
      );
      continue;
    }
    if (v.despeckle !== undefined && typeof v.despeckle !== 'boolean') {
      bad(`${path}.despeckle`, 'must be true or false');
      continue;
    }
    const src = parseSource({ src: v.src, frames }, path, root, undefined, bad, () => undefined);
    if (!src) continue;
    const piece: TileSource = src;
    if (v.despeckle === true) piece.despeckle = true;
    out.pieces[name] = piece;
  }
  return out;
}

function parseGround(
  v: Json,
  path: string,
  bad: (p: string, m: string) => void,
): Ground | undefined {
  if (v === undefined) return undefined;
  if (v === 'frame' || v === 'canvas') return v;
  if (isObj(v) && Object.keys(v).length === 1 && isInt(v.ref) && v.ref >= 0) return { ref: v.ref };
  bad(path, 'must be "frame", "canvas" or { "ref": <source frame index> }');
  return undefined;
}

function parseSource(
  v: Json,
  path: string,
  root: string,
  ground: Ground | undefined,
  bad: (p: string, m: string) => void,
  unknownKeys: (p: string, v: Record<string, Json>, allowed: readonly string[]) => void,
): FrameSource | null {
  if (!isObj(v)) {
    bad(path, 'must be an object with "src" and "frames"');
    return null;
  }
  unknownKeys(path, v, ['src', 'frames', 'downscale', 'flipX']);
  const { src, frames, downscale, flipX } = v;
  let ok = true;
  if (typeof src !== 'string' || !src.startsWith('art/') || src.split('/').includes('..')) {
    bad(`${path}.src`, 'must be a repo-relative path under art/');
    ok = false;
  }
  if (!Array.isArray(frames) || frames.length === 0 || !frames.every((n) => isInt(n) && n >= 0)) {
    bad(`${path}.frames`, 'must be a non-empty list of source frame indices');
    ok = false;
  }
  if (downscale !== undefined && !(isInt(downscale) && downscale >= 2)) {
    bad(`${path}.downscale`, 'must be a whole number, 2 or more');
    ok = false;
  }
  if (flipX !== undefined && typeof flipX !== 'boolean') {
    bad(`${path}.flipX`, 'must be true or false');
    ok = false;
  }
  if (!ok) return null;
  const s: FrameSource = { src: src as string, frames: frames as number[] };
  if (downscale !== undefined) s.downscale = downscale as number;
  if (flipX === true) s.flipX = true;
  const abs = join(root, s.src);
  if (!existsSync(abs)) {
    bad(`${path}.src`, `${s.src} does not exist`);
    return null;
  }
  const needed = [...s.frames];
  if (ground !== undefined && typeof ground === 'object') needed.push(ground.ref);
  if (statSync(abs).isDirectory()) {
    for (const n of new Set(needed)) {
      if (!existsSync(join(abs, `frame-${n}.png`)))
        bad(`${path}.frames`, `${s.src}/frame-${n}.png does not exist`);
    }
  } else if (s.src.endsWith('.png')) {
    if (needed.some((n) => n !== 0))
      bad(`${path}.frames`, `${s.src} is a single PNG: its only frame is 0`);
  } else if (!s.src.endsWith('.gif')) {
    bad(`${path}.src`, `${s.src} is not a folder of frame-<n>.png, a .png or a .gif`);
  }
  return s;
}

/** The key of every animation × facing a recipe builds, for messages. */
export function recipeAnimKeys(recipe: Recipe): string[] {
  return Object.entries(recipe.anims).flatMap(([anim, a]) =>
    animSources(recipe.kind, a).map(([f]) => animKey(anim, f)),
  );
}

/** A prop recipe's own numbers for the animations it rates (`idle`, the chest's `closed`): frame count and rate, by name (null for other kinds). */
export function propGivenOf(recipe: Recipe): PropGiven | null {
  if (recipe.kind !== 'prop') return null;
  const out: PropGiven = {};
  for (const name of recipeRatedAnims(recipe.sheet)) {
    const a = recipe.anims[name];
    if (!a) continue;
    const given: PropAnimGiven = { frames: a.source?.frames.length ?? 0 };
    if (a.fps !== undefined) given.fps = a.fps;
    out[name] = given;
  }
  return out;
}

/** The animation table a recipe's finished sheet carries (see `sheetTable`), or null when the contract has none. */
export function recipeTable(recipe: Recipe): readonly SpriteAnimSpec[] | null {
  return sheetTable(recipe.sheet, propGivenOf(recipe));
}
