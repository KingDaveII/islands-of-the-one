import piecesJson from '../data/pieces.json' with { type: 'json' };
import stationsJson from '../data/stations.json' with { type: 'json' };
import { isDrawable } from './accounts.js';
import {
  HOLDING_GROUND,
  HOLDING_START,
  PLOT_SIZE,
  type HoldingLayout,
  type LayoutPlot,
  type StationCycle,
  type TilePoint,
  type TileRect,
} from './holding.js';
import { isItemId, pluralItemName, SKILL_NAMES } from './items.js';
import { isSkill, type Skill } from './skills.js';

/**
 * Upgrade pieces and build mode (docs/design/holding.md "Build mode", M2
 * Task 6; GAME DESIGN's "Building upgrades", 2026-10-15: "A station is
 * upgraded by building pieces around it, as physical objects in the world,
 * not by pressing a button"; LORE §16.8 named them). The pieces are data
 * (data/pieces.json, validated on load like items.json); the rules here are
 * pure and shared by the server (the build routes) and the client (the
 * ghost): a plot's level and its cycle's speed from the pieces standing in
 * it, the limit per Writ line, and whether a footprint can stand where it is
 * asked to. Every player-facing line of build mode is in `BUILD_TEXT`, so
 * LORE's and GAME DESIGN's answers are a text edit.
 */

/** The effect every piece has today (GAME DESIGN's placeholder): +permille to its station's cycle speed, additive. */
export interface PieceEffect {
  kind: 'cycle-speed';
  permille: number;
}
export const PIECE_EFFECT_KINDS = ['cycle-speed'] as const;

export interface PieceCost {
  itemId: string;
  quantity: number;
}

/** A piece's footprint in tiles, before rotation (90 and 270 swap cols and rows). */
export interface PieceFootprint {
  cols: number;
  rows: number;
}

export interface PieceSkill {
  skill: Skill;
  level: number;
}

export interface PieceDef {
  /** kebab-case, permanent: stored in `plot_pieces`. */
  id: string;
  /** A plot kind of stations.json (for a piece that can be built); a station without a Ground word yet for the rest. */
  stationKind: string;
  /** LORE's, word for word. */
  name: string;
  card: string;
  /** False for the pieces of stations that don't exist yet: no cost, no footprint, and the build route refuses them. */
  available: boolean;
  /** Taken from the store (the pack doesn't count); null while unavailable. */
  cost: readonly PieceCost[] | null;
  /** Null while unavailable. */
  footprint: PieceFootprint | null;
  skill: PieceSkill | null;
  /** The Writ line needed, 1 or more. */
  writLine: number;
  effect: PieceEffect;
}

/** A piece that can be built: its cost and footprint are known. */
export interface AvailablePieceDef extends PieceDef {
  available: true;
  cost: readonly PieceCost[];
  footprint: PieceFootprint;
}

export const PIECE_ROTATIONS = [0, 90, 180, 270] as const;
export type PieceRotation = (typeof PIECE_ROTATIONS)[number];

export function isPieceRotation(value: unknown): value is PieceRotation {
  return typeof value === 'number' && (PIECE_ROTATIONS as readonly number[]).includes(value);
}

/** A piece standing in a plot (the wire's `PlotPieceView` and the `plot_pieces` row): its kind and its footprint's top-left tile and rotation. */
export interface StandingPiece {
  pieceId: string;
  col: number;
  row: number;
  rotation: PieceRotation;
}

export interface PiecesData {
  piecesPerLine: number;
  pieces: PieceDef[];
}

const PIECE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const KEYS = ['id', 'stationKind', 'name', 'card', 'available', 'cost', 'footprint', 'skill', 'writLine', 'effect'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function parseCost(value: unknown, where: string, problems: string[]): PieceCost[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    problems.push(`${where}: cost must be a non-empty list of { itemId, quantity }`);
    return null;
  }
  const before = problems.length;
  const seen = new Set<string>();
  const out: PieceCost[] = [];
  value.forEach((entry: unknown, i) => {
    const at = `${where}.cost[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${at}: must be { itemId, quantity }`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !['itemId', 'quantity'].includes(k));
    if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
    if (!isItemId(entry.itemId)) problems.push(`${at}: itemId must be an item of items.json`);
    else if (seen.has(entry.itemId)) problems.push(`${at}: ${entry.itemId} is listed twice`);
    else seen.add(entry.itemId);
    if (!isCount(entry.quantity)) problems.push(`${at}: quantity must be a positive integer`);
    if (isItemId(entry.itemId) && isCount(entry.quantity)) out.push({ itemId: entry.itemId, quantity: entry.quantity });
  });
  return problems.length > before ? null : out;
}

function parseFootprint(value: unknown, where: string, problems: string[]): PieceFootprint | null {
  if (!isObject(value) || !isCount(value.cols) || !isCount(value.rows)) {
    problems.push(`${where}: footprint must be { cols, rows } of positive integers`);
    return null;
  }
  const extra = Object.keys(value).filter((k) => !['cols', 'rows'].includes(k));
  if (extra.length > 0) problems.push(`${where}: footprint has unknown field(s) ${extra.join(', ')}`);
  if (value.cols > PLOT_SIZE || value.rows > PLOT_SIZE) {
    problems.push(`${where}: footprint ${value.cols} x ${value.rows} doesn't fit a ${PLOT_SIZE} x ${PLOT_SIZE} plot`);
    return null;
  }
  return { cols: value.cols, rows: value.rows };
}

function parseSkill(value: unknown, where: string, problems: string[]): PieceSkill | null {
  if (!isObject(value)) {
    problems.push(`${where}: skill must be { skill, level } or null`);
    return null;
  }
  const extra = Object.keys(value).filter((k) => !['skill', 'level'].includes(k));
  if (extra.length > 0) problems.push(`${where}: skill has unknown field(s) ${extra.join(', ')}`);
  if (!isSkill(value.skill)) problems.push(`${where}: skill.skill must be a skill`);
  if (!isCount(value.level)) problems.push(`${where}: skill.level must be a positive integer`);
  if (!isSkill(value.skill) || !isCount(value.level)) return null;
  return { skill: value.skill, level: value.level };
}

function parseEffect(value: unknown, where: string, problems: string[]): PieceEffect | null {
  if (!isObject(value)) {
    problems.push(`${where}: effect must be an object`);
    return null;
  }
  if (value.kind !== 'cycle-speed') {
    problems.push(`${where}: effect.kind must be one of ${PIECE_EFFECT_KINDS.join(', ')}`);
    return null;
  }
  const extra = Object.keys(value).filter((k) => !['kind', 'permille'].includes(k));
  if (extra.length > 0) problems.push(`${where}: effect has unknown field(s) ${extra.join(', ')}`);
  if (!isCount(value.permille)) {
    problems.push(`${where}: effect.permille must be a positive integer`);
    return null;
  }
  return { kind: 'cycle-speed', permille: value.permille };
}

/**
 * Check pieces.json-shaped data against the plot kinds of stations.json
 * (`plotKindIds`); every problem is listed. An available piece names a plot
 * kind, a cost and a footprint; an unavailable one (a station without a
 * Ground word yet) names a kebab-case station kind and carries neither.
 */
export function validatePiecesData(
  data: unknown,
  plotKindIds: readonly string[],
): { ok: true; data: PiecesData } | { ok: false; problems: string[] } {
  if (!isObject(data) || !Array.isArray(data.pieces)) return { ok: false, problems: ['expected { piecesPerLine, pieces: [...] }'] };
  const problems: string[] = [];
  const extraTop = Object.keys(data).filter((k) => !['$comment', 'piecesPerLine', 'pieces'].includes(k));
  if (extraTop.length > 0) problems.push(`unknown field(s) ${extraTop.join(', ')}`);
  if (!isCount(data.piecesPerLine)) problems.push('piecesPerLine must be a positive integer');
  const pieces: PieceDef[] = [];
  const seen = new Set<string>();
  data.pieces.forEach((entry: unknown, i) => {
    const at = `pieces[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${at}: not an object`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !KEYS.includes(k));
    if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
    const { id, stationKind, name, card, available, cost, footprint, skill, writLine, effect } = entry;
    if (typeof id !== 'string' || !PIECE_ID.test(id)) {
      problems.push(`${at}: id must be kebab-case (it is stored)`);
      return;
    }
    const where = `${at} (${id})`;
    if (seen.has(id)) problems.push(`${where}: duplicate id`);
    seen.add(id);
    const before = problems.length;
    if (available !== undefined && typeof available !== 'boolean') problems.push(`${where}: available must be a boolean when present`);
    const isAvailable = available !== false;
    if (typeof stationKind !== 'string' || !PIECE_ID.test(stationKind)) problems.push(`${where}: stationKind must be kebab-case`);
    else if (isAvailable && !plotKindIds.includes(stationKind))
      problems.push(`${where}: an available piece's stationKind must be a plot kind of stations.json (${plotKindIds.join(', ') || 'none'})`);
    for (const [key, text] of [
      ['name', name],
      ['card', card],
    ] as const)
      if (typeof text !== 'string' || text.trim() === '') problems.push(`${where}: ${key} must be non-empty text`);
      else {
        const missing = Array.from(text).filter((ch) => !isDrawable(ch));
        if (missing.length > 0) problems.push(`${where}: the fonts can't draw "${missing[0] ?? ''}" in ${key} (don't change the text; flag it)`);
      }
    let parsedCost: PieceCost[] | null = null;
    let parsedFootprint: PieceFootprint | null = null;
    if (isAvailable) {
      parsedCost = parseCost(cost, where, problems);
      parsedFootprint = parseFootprint(footprint, where, problems);
    } else {
      if (cost !== undefined) problems.push(`${where}: an unavailable piece has no cost`);
      if (footprint !== undefined) problems.push(`${where}: an unavailable piece has no footprint`);
    }
    let parsedSkill: PieceSkill | null = null;
    if (skill === undefined) problems.push(`${where}: skill must be { skill, level } or null`);
    else if (skill !== null) parsedSkill = parseSkill(skill, where, problems);
    if (!isCount(writLine)) problems.push(`${where}: writLine must be a positive integer`);
    const parsedEffect = parseEffect(effect, where, problems);
    if (problems.length > before || !parsedEffect) return;
    pieces.push({
      id,
      stationKind: stationKind as string,
      name: name as string,
      card: card as string,
      available: isAvailable,
      cost: parsedCost,
      footprint: parsedFootprint,
      skill: parsedSkill,
      writLine: writLine as number,
      effect: parsedEffect,
    });
  });
  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, data: { piecesPerLine: data.piecesPerLine as number, pieces } };
}

const PLOT_KIND_IDS: readonly string[] = stationsJson.plotKinds.map((p) => p.id);

function loadPieces(): PiecesData {
  const result = validatePiecesData(piecesJson, PLOT_KIND_IDS);
  if (!result.ok) throw new Error(`data/pieces.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const piecesData: PiecesData = loadPieces();
/** Every piece, in pieces.json order. */
export const PIECES: readonly PieceDef[] = piecesData.pieces;
/** How many pieces a plot may hold per Writ line (GAME DESIGN: two per station per Writ line). */
export const PIECES_PER_LINE: number = piecesData.piecesPerLine;
const PIECE_BY_ID: ReadonlyMap<string, PieceDef> = new Map(PIECES.map((p) => [p.id, p]));

export function pieceDef(id: string): PieceDef | undefined {
  return PIECE_BY_ID.get(id);
}

export function isPieceId(value: unknown): value is string {
  return typeof value === 'string' && PIECE_BY_ID.has(value);
}

/** Whether a piece can be built: it is in pieces.json and available (its cost and footprint known). */
export function isAvailablePiece(def: PieceDef | undefined): def is AvailablePieceDef {
  return def !== undefined && def.available && def.cost !== null && def.footprint !== null;
}

/** The pieces a station kind can take (its available ones), in pieces.json order. */
export function piecesFor(stationKind: string, pieces: readonly PieceDef[] = PIECES): AvailablePieceDef[] {
  return pieces.filter((p): p is AvailablePieceDef => p.stationKind === stationKind && isAvailablePiece(p));
}

// --- The level and the speed -------------------------------------------------------

/** The distinct piece kinds standing (each kind counts once). */
function distinctIds(pieces: readonly Pick<StandingPiece, 'pieceId'>[]): string[] {
  return [...new Set(pieces.map((p) => p.pieceId))];
}

/** A plot's level: 1 plus the distinct piece kinds standing in it (GAME DESIGN). */
export function plotLevel(pieces: readonly Pick<StandingPiece, 'pieceId'>[] = []): number {
  return 1 + distinctIds(pieces).length;
}

/** A station's cycle speed in permille of the base: 1000 plus the standing pieces' effects, each kind once (+250 each today). */
export function cycleSpeedPermille(pieces: readonly Pick<StandingPiece, 'pieceId'>[] = []): number {
  let speed = 1000;
  for (const id of distinctIds(pieces)) speed += pieceDef(id)?.effect.permille ?? 0;
  return speed;
}

/** A basket cycle's real length: `round(cycleMs × 1000 / speed)` (the field: 15 min, 12 min with one piece, 10 with two). */
export function cycleLengthMs(cycle: Pick<StationCycle, 'cycleMs'>, pieces: readonly Pick<StandingPiece, 'pieceId'>[] = []): number {
  return Math.round((cycle.cycleMs * 1000) / cycleSpeedPermille(pieces));
}

/** How many pieces a plot may hold: `piecesPerLine` × the Kindled's Writ lines (2 in M2). */
export function pieceLimit(writLines: number, perLine: number = PIECES_PER_LINE): number {
  return perLine * Math.max(0, writLines);
}

// --- Footprints and placement ----------------------------------------------------------

/** A footprint turned: 90 and 270 swap its cols and rows. */
export function rotatedFootprint(footprint: PieceFootprint, rotation: PieceRotation): PieceFootprint {
  return rotation === 90 || rotation === 270 ? { cols: footprint.rows, rows: footprint.cols } : { ...footprint };
}

/** The next rotation clockwise (R, Triangle): 0, 90, 180, 270, 0. */
export function nextRotation(rotation: PieceRotation): PieceRotation {
  return PIECE_ROTATIONS[(PIECE_ROTATIONS.indexOf(rotation) + 1) % PIECE_ROTATIONS.length] ?? 0;
}

/** The tiles a footprint covers standing at (col, row) with a rotation. */
export function pieceRect(footprint: PieceFootprint, col: number, row: number, rotation: PieceRotation): TileRect {
  const fp = rotatedFootprint(footprint, rotation);
  return { col, row, cols: fp.cols, rows: fp.rows };
}

/** The rectangle a standing piece covers, or null for a piece this build doesn't know (or can't build). */
export function standingRect(piece: StandingPiece): TileRect | null {
  const def = pieceDef(piece.pieceId);
  if (!isAvailablePiece(def)) return null;
  return pieceRect(def.footprint, piece.col, piece.row, piece.rotation);
}

/** Every tile of a rectangle, row by row. */
export function rectTiles(rect: TileRect): TilePoint[] {
  const out: TilePoint[] = [];
  for (let r = rect.row; r < rect.row + rect.rows; r++) for (let c = rect.col; c < rect.col + rect.cols; c++) out.push({ col: c, row: r });
  return out;
}

/** The tiles the standing pieces cover (pillars for the roam). */
export function standingTiles(pieces: readonly StandingPiece[]): TilePoint[] {
  return pieces.flatMap((p) => {
    const rect = standingRect(p);
    return rect ? rectTiles(rect) : [];
  });
}

const within = (inner: TileRect, outer: TileRect): boolean =>
  inner.col >= outer.col && inner.row >= outer.row && inner.col + inner.cols <= outer.col + outer.cols && inner.row + inner.rows <= outer.row + outer.rows;
const overlaps = (a: TileRect, b: TileRect): boolean =>
  a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
const covers = (rect: TileRect, p: TilePoint): boolean =>
  p.col >= rect.col && p.col < rect.col + rect.cols && p.row >= rect.row && p.row < rect.row + rect.rows;

/** Whether a layout tile is ground the Kindled can walk (the plots' ground and the start; station letters and the edge are not). */
export function isWalkableTile(layout: HoldingLayout, col: number, row: number): boolean {
  const ch = layout.tiles[row]?.[col];
  return ch === HOLDING_GROUND || ch === HOLDING_START;
}

/** Why a footprint can't stand where it is asked to, in the order the server's refusal names them. */
export const PLACEMENT_PROBLEMS = ['outside', 'on-signpost', 'overlaps', 'blocks-signpost'] as const;
export type PlacementProblem = (typeof PLACEMENT_PROBLEMS)[number];

/** Where a piece is asked to stand: its kind (the footprint comes from pieces.json), its top-left tile and its rotation. */
export type Placement = StandingPiece;

/**
 * The reasons a piece can't stand where it is asked to (an empty list means
 * it fits; the ghost is green exactly then): `outside`, not wholly inside the
 * plot's square; `on-signpost`, over the signpost's tile or its interact
 * tile; `overlaps`, over another piece of the plot (the piece of the
 * candidate's own kind, if one stands, is the one being moved, and doesn't
 * block itself: each kind stands once per plot); `blocks-signpost`, GAME
 * DESIGN's rule (2026-10-18): "there must always be a walkable way from the
 * plot's edge to the signpost": a flood fill inside the plot with the
 * signpost, every standing piece and the candidate solid, from every free
 * edge tile that has walkable ground outside it, must reach the signpost's
 * interact tile. Throws for a piece this build can't build (the server
 * refuses it as `unknown-piece` first; the client only offers available
 * pieces).
 */
export function placementProblems(
  layout: HoldingLayout,
  plot: LayoutPlot,
  pieces: readonly StandingPiece[],
  candidate: Placement,
): PlacementProblem[] {
  const def = pieceDef(candidate.pieceId);
  if (!isAvailablePiece(def)) throw new Error(`placement: ${candidate.pieceId} is not a piece that can be built`);
  const rect = pieceRect(def.footprint, candidate.col, candidate.row, candidate.rotation);
  const problems: PlacementProblem[] = [];
  if (!within(rect, plot.rect)) problems.push('outside');
  const signpost = plot.station.rect;
  const interact = plot.station.interact;
  const onSignpost = overlaps(rect, signpost) || covers(rect, interact);
  if (onSignpost) problems.push('on-signpost');
  // The other pieces standing: the candidate's own kind is the one being moved.
  const others = pieces.filter((p) => p.pieceId !== candidate.pieceId);
  const otherRects = others.map(standingRect).filter((r): r is TileRect => r !== null);
  if (otherRects.some((r) => overlaps(rect, r))) problems.push('overlaps');
  if (!onSignpost && !signpostReachable(layout, plot, [...otherRects, rect])) problems.push('blocks-signpost');
  return problems;
}

/**
 * Whether the signpost's interact tile can be reached inside the plot from
 * its edge, with the signpost and the given rectangles solid: the fill
 * starts from every free edge tile of the plot that has walkable ground
 * outside it and walks the plot's free tiles four ways.
 */
export function signpostReachable(layout: HoldingLayout, plot: LayoutPlot, solid: readonly TileRect[]): boolean {
  const { rect, station } = plot;
  const blocked = (c: number, r: number): boolean =>
    covers(station.rect, { col: c, row: r }) || solid.some((s) => covers(s, { col: c, row: r }));
  const inside = (c: number, r: number): boolean => covers(rect, { col: c, row: r });
  const free = (c: number, r: number): boolean => inside(c, r) && isWalkableTile(layout, c, r) && !blocked(c, r);
  const key = (c: number, r: number): string => `${c},${r}`;
  const seen = new Set<string>();
  const stack: TilePoint[] = [];
  for (const t of rectTiles(rect)) {
    const edge = t.col === rect.col || t.col === rect.col + rect.cols - 1 || t.row === rect.row || t.row === rect.row + rect.rows - 1;
    if (!edge || !free(t.col, t.row)) continue;
    const outsideWalkable = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
    ).some(([dc, dr]) => !inside(t.col + dc, t.row + dr) && isWalkableTile(layout, t.col + dc, t.row + dr));
    if (!outsideWalkable) continue;
    seen.add(key(t.col, t.row));
    stack.push(t);
  }
  while (stack.length > 0) {
    const p = stack.pop();
    if (!p) break;
    if (p.col === station.interact.col && p.row === station.interact.row) return true;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const c = p.col + dc;
      const r = p.row + dr;
      if (seen.has(key(c, r)) || !free(c, r)) continue;
      seen.add(key(c, r));
      stack.push({ col: c, row: r });
    }
  }
  return false;
}

// --- Text ---------------------------------------------------------------------------

/** Placeholder words for each placement reason (MAIN's, until LORE answers), after LORE's "That doesn't fit there.". */
export const PLACEMENT_WORDS: Readonly<Record<PlacementProblem, string>> = {
  outside: "It has to stand inside the plot's ring.",
  'on-signpost': "It's on top of the signpost.",
  overlaps: "It's on top of another piece.",
  'blocks-signpost': 'It would block the way to the signpost.',
};

/**
 * Every player-facing line of build mode in one place: LORE's and GAME
 * DESIGN's, word for word (their answers of 2026-10-18). The refusal lines
 * the brief gives only a code for (unknown piece, already built, not built)
 * and the placement reasons' words are MAIN's short placeholders.
 */
export const BUILD_TEXT = {
  // The field's station panel (GAME DESIGN: "Use a station → Build here").
  BUILD_HERE: 'BUILD HERE',
  /** The active action's rate and the cycle's on a plot's panel (GAME DESIGN: "By itself: 1 pale grain every 12 min" and "By hand" stays at 20 s). */
  BY_HAND: 'By hand: ',
  BY_ITSELF: 'By itself: ',
  // Build mode's header (LORE: a comma, keeping the dot for the plot sentence's divider).
  HEADER: (kindName: string, level: number): string => `${kindName}, level ${level}`,
  PIECES_COUNT: (standing: number, limit: number): string => `Pieces ${standing}/${limit}`,
  /** The plot sentence panel's pieces line (LORE) when none stands; else the pieces' names, comma-separated. */
  PIECES_NONE_YET: 'Pieces: none yet',
  PIECES_LIST: (names: readonly string[]): string => `Pieces: ${names.join(', ')}`,
  // The side list (LORE's lines).
  /** "Twisted log 340/300": the item's display name, what the store holds, what the piece needs. */
  MATERIAL: (name: string, have: number, need: number): string => `${name} ${have}/${need}`,
  NEEDS_LINE: (line: number): string => `Needs Writ line ${line}`,
  NEEDS_SKILL: (skillName: string, level: number): string => `Needs ${skillName} ${level}`,
  /** GAME DESIGN's effect, shown apart from the card: "+25% work speed" (LORE's wording). */
  EFFECT_SPEED: (percent: number): string => `+${percent}% work speed`,
  MOVE: 'MOVE',
  TAKE_DOWN: 'TAKE DOWN',
  /** The turn button beside the ghost on touch (LORE). */
  TURN: 'TURN',
  /** The side list's line for a piece already standing in this plot, in place of its cost (GAME DESIGN 2026-10-19). */
  STANDING: 'Standing',
  /** Touch: after the first tap places the ghost, the footer says how to build it (GAME DESIGN 2026-10-19). */
  TAP_AGAIN: 'Tap again to build',
  /** A take-down's refund, one float per item by its display name (LORE: "+300 Twisted log", never a bare total). */
  REFUND: (quantity: number, name: string): string => `+${quantity} ${name}`,
  // The refusals (LORE's lines, the server's messages).
  INSUFFICIENT: 'Not enough in the store.',
  BLOCKED: "That doesn't fit there.",
  /** `blocked`: LORE's line, then the first reason (LORE's words, `PLACEMENT_WORDS`). */
  BLOCKED_BECAUSE: (reason: PlacementProblem): string => `That doesn't fit there. ${PLACEMENT_WORDS[reason]}`,
  LIMIT: 'This plot can take no more pieces until your Writ has another line.',
  NEEDS_LINE_REFUSAL: (line: number): string => `Needs Writ line ${line}.`,
  NEEDS_SKILL_REFUSAL: (skillName: string, level: number): string => `Needs ${skillName} ${level}.`,
  /** `store-full`: the take-all's line (GAME DESIGN: "Store: twisted logs full."). */
  STORE_FULL: (itemId: string): string => `Store: ${pluralItemName(itemId)} full.`,
  /** `unknown-piece` (LORE 2026-10-19). */
  UNKNOWN_PIECE: "This station doesn't take that piece.",
  /** `already-built` (LORE). */
  ALREADY_BUILT: 'One of those already stands in this plot.',
  /** `not-built` (LORE). */
  NOT_BUILT: "That piece isn't standing here.",
} as const;

/** The skill line a piece needs, by its display name: "Needs Farming 5". */
export function needsSkillLine(skill: PieceSkill): string {
  return BUILD_TEXT.NEEDS_SKILL(SKILL_NAMES[skill.skill], skill.level);
}

/** Every string of BUILD_TEXT and the lines its functions make, for the drawable-characters test. */
export function buildTextLines(): string[] {
  const out: string[] = [];
  for (const v of Object.values(BUILD_TEXT)) if (typeof v === 'string') out.push(v);
  out.push(
    BUILD_TEXT.HEADER('Field', 2),
    BUILD_TEXT.PIECES_COUNT(1, 2),
    BUILD_TEXT.PIECES_LIST(['Clay channel', 'Seed jars']),
    BUILD_TEXT.MATERIAL('Twisted log', 340, 300),
    BUILD_TEXT.NEEDS_LINE(2),
    BUILD_TEXT.NEEDS_SKILL('Farming', 5),
    BUILD_TEXT.EFFECT_SPEED(25),
    BUILD_TEXT.NEEDS_LINE_REFUSAL(2),
    BUILD_TEXT.NEEDS_SKILL_REFUSAL('Farming', 5),
    BUILD_TEXT.STORE_FULL('twisted-log'),
    ...PLACEMENT_PROBLEMS.map((p) => BUILD_TEXT.BLOCKED_BECAUSE(p)),
  );
  return out;
}
