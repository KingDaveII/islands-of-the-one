import {
  BUILD_TEXT,
  isAvailablePiece,
  itemDef,
  needsSkillLine,
  nextRotation,
  pieceDef,
  pieceLimit,
  pieceRect,
  piecesFor,
  placementProblems,
  plotLevel,
  standingRect,
  standingTiles,
  TILE_SIZE_PX,
  type AvailablePieceDef,
  type HoldingLayout,
  type InventoryResponse,
  type LayoutPlot,
  type PieceFootprint,
  type PieceRotation,
  type PlacementProblem,
  type PlotsTuning,
  type PlotView,
  type Skill,
  type SkillView,
  type StandingPiece,
  type TilePoint,
  type TileRect,
  WORLD_PX_PER_UNIT,
} from '@iot/shared';
import { displayable } from './drawable.js';
import type { WorldRect } from './plotView.js';

/**
 * Build mode on the client (docs/design/holding.md "Build mode", M2 Task 6),
 * pure so it is tested in node: the side list's rows (each piece this
 * station can take, its placeholder picture, its materials against the
 * store, what it needs, its effect line and LORE's card), the header, the
 * ghost's colour from `placementProblems` plus the Kindled's own tile, the
 * rotation, the pad's tile cursor, the building moment's phases from the
 * tuning, and the pieces' tiles for the roam. The scene (ui/buildMode.ts,
 * render/pieces.ts) draws these and sends the routes; the server's answer
 * decides everything.
 */

/** A tile's side in world px (the world draws at 2 per sim px). */
export const TILE_WORLD_PX = TILE_SIZE_PX * WORLD_PX_PER_UNIT;

/** The icon placeholder for a piece until ART draws it: its name's initials ("Clay channel" → "CC", "Saw-horse" → "SH"). */
export function pieceInitials(name: string): string {
  return displayable(
    name
      .split(/[\s-]+/)
      .filter((w) => w !== '')
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2),
  );
}

/** One material of a piece against the store: "Twisted log 340/300"; `short` when the store holds too few (the warning token). */
export interface MaterialLine {
  itemId: string;
  text: string;
  short: boolean;
}

/** One row of the side list. */
export interface PieceRowLines {
  pieceId: string;
  name: string;
  initials: string;
  footprint: PieceFootprint;
  materials: MaterialLine[];
  /** "Needs Writ line 2" / "Needs Farming 5", or null. */
  needs: string | null;
  /** GAME DESIGN's effect, apart from the card: "+25% work speed". */
  effect: string;
  /** LORE's card, the row's tooltip. */
  card: string;
  /** Needs a Writ line or a skill level the Kindled lacks: shown with what it needs, not pickable. */
  locked: boolean;
  /** Standing in this plot already (each kind once): not pickable to build; it is moved or taken down instead. */
  built: boolean;
  /** The store holds every material. */
  affordable: boolean;
}

/** What the store holds of an item. */
export function inStore(inventory: Pick<InventoryResponse, 'store'> | null, itemId: string): number {
  return inventory?.store.find((e) => e.itemId === itemId)?.quantity ?? 0;
}

/** The materials lines of a piece against the store, by the item's display name (LORE). */
export function materialLines(def: AvailablePieceDef, inventory: Pick<InventoryResponse, 'store'> | null): MaterialLine[] {
  return def.cost.map((c) => {
    const have = inStore(inventory, c.itemId);
    return {
      itemId: c.itemId,
      text: BUILD_TEXT.MATERIAL(displayable(itemDef(c.itemId)?.name ?? c.itemId.replaceAll('-', ' ')), have, c.quantity),
      short: have < c.quantity,
    };
  });
}

/** What a piece needs that the Kindled lacks: the Writ line first, then the skill level; null when nothing. */
export function needsLine(def: AvailablePieceDef, writLines: number, skills: Partial<Record<Skill, Pick<SkillView, 'level'>>>): string | null {
  if (def.writLine > writLines) return BUILD_TEXT.NEEDS_LINE(def.writLine);
  if (def.skill && (skills[def.skill.skill]?.level ?? 1) < def.skill.level) return needsSkillLine(def.skill);
  return null;
}

/** The side list: the pieces this station kind can take, in pieces.json order. */
export function pieceRows(
  kindId: string,
  plot: Pick<PlotView, 'pieces'>,
  inventory: Pick<InventoryResponse, 'store'> | null,
  writLines: number,
  skills: Partial<Record<Skill, Pick<SkillView, 'level'>>>,
): PieceRowLines[] {
  return piecesFor(kindId).map((def) => {
    const materials = materialLines(def, inventory);
    const needs = needsLine(def, writLines, skills);
    return {
      pieceId: def.id,
      name: displayable(def.name),
      initials: pieceInitials(def.name),
      footprint: def.footprint,
      materials,
      needs,
      effect: BUILD_TEXT.EFFECT_SPEED(Math.round(def.effect.permille / 10)),
      card: displayable(def.card),
      locked: needs !== null,
      built: plot.pieces.some((p) => p.pieceId === def.id),
      affordable: materials.every((m) => !m.short),
    };
  });
}

/** Build mode's header: "Field, level 2" and "Pieces 1/2". */
export function buildHeader(plot: Pick<PlotView, 'pieces'>, kindName: string, writLines: number): { title: string; count: string } {
  return {
    title: BUILD_TEXT.HEADER(displayable(kindName), plotLevel(plot.pieces)),
    count: BUILD_TEXT.PIECES_COUNT(plot.pieces.length, pieceLimit(writLines)),
  };
}

/** The plot sentence panel's pieces line: the standing pieces' names, or "Pieces: none yet" (LORE). */
export function piecesLine(pieces: readonly Pick<StandingPiece, 'pieceId'>[]): string {
  if (pieces.length === 0) return BUILD_TEXT.PIECES_NONE_YET;
  return BUILD_TEXT.PIECES_LIST(pieces.map((p) => displayable(pieceDef(p.pieceId)?.name ?? p.pieceId)));
}

// --- The ghost --------------------------------------------------------------------

/** The ghost: a piece's footprint following the pointer or the cursor; `moving` when it is a standing piece being moved. */
export interface Ghost {
  pieceId: string;
  col: number;
  row: number;
  rotation: PieceRotation;
  moving: boolean;
}

/** The tile under a sim-px point. */
export function tileOfSim(x: number, y: number): TilePoint {
  return { col: Math.floor(x / TILE_SIZE_PX), row: Math.floor(y / TILE_SIZE_PX) };
}

/** The tile under a world-px point. */
export function tileOfWorld(x: number, y: number): TilePoint {
  return { col: Math.floor(x / TILE_WORLD_PX), row: Math.floor(y / TILE_WORLD_PX) };
}

/** The ghost's footprint rectangle, or null for a piece this build can't build. */
export function ghostRect(ghost: Pick<Ghost, 'pieceId' | 'col' | 'row' | 'rotation'>): TileRect | null {
  const def = pieceDef(ghost.pieceId);
  return isAvailablePiece(def) ? pieceRect(def.footprint, ghost.col, ghost.row, ghost.rotation) : null;
}

/** The ghost placed under a tile: its footprint centred on it (the top-left tile of an even side is the one nearer the pointer). */
export function ghostAt(ghost: Ghost, tile: TilePoint): Ghost {
  const rect = ghostRect(ghost);
  if (!rect) return { ...ghost, col: tile.col, row: tile.row };
  return { ...ghost, col: tile.col - Math.floor((rect.cols - 1) / 2), row: tile.row - Math.floor((rect.rows - 1) / 2) };
}

/** The ghost turned a step clockwise about the same top-left tile. */
export function rotateGhost(ghost: Ghost): Ghost {
  return { ...ghost, rotation: nextRotation(ghost.rotation) };
}

/** What the ghost's colour comes from: the shared placement reasons, plus the Kindled's own tile (positions are the client's). */
export interface GhostFit {
  fits: boolean;
  problems: PlacementProblem[];
  onKindled: boolean;
}

export function ghostFit(
  layout: HoldingLayout,
  plot: LayoutPlot,
  pieces: readonly StandingPiece[],
  ghost: Ghost,
  kindledTile: TilePoint | null,
): GhostFit {
  const problems = placementProblems(layout, plot, pieces, ghost);
  const rect = ghostRect(ghost);
  const onKindled =
    kindledTile !== null &&
    rect !== null &&
    kindledTile.col >= rect.col &&
    kindledTile.col < rect.col + rect.cols &&
    kindledTile.row >= rect.row &&
    kindledTile.row < rect.row + rect.rows;
  return { fits: problems.length === 0 && !onKindled, problems, onKindled };
}

// --- The pad's cursor ---------------------------------------------------------------

/** Where the pad's tile cursor starts: the plot's top-left tile (the ghost is centred on the cursor, so a 1 × 4 starts a row in). */
export function cursorStart(plot: LayoutPlot): TilePoint {
  return { col: plot.rect.col + 1, row: plot.rect.row + 1 };
}

/** The cursor stepped by the D-pad or the stick, kept inside the plot's square. */
export function stepCursor(cursor: TilePoint, dc: number, dr: number, plot: LayoutPlot): TilePoint {
  const { rect } = plot;
  return {
    col: Math.max(rect.col, Math.min(rect.col + rect.cols - 1, cursor.col + dc)),
    row: Math.max(rect.row, Math.min(rect.row + rect.rows - 1, cursor.row + dr)),
  };
}

/** The standing piece under a tile, if any (clicking it, or the cursor on it, selects it). */
export function pieceAt(pieces: readonly StandingPiece[], tile: TilePoint): StandingPiece | undefined {
  return pieces.find((p) => {
    const r = standingRect(p);
    return r !== null && tile.col >= r.col && tile.col < r.col + r.cols && tile.row >= r.row && tile.row < r.row + r.rows;
  });
}

// --- The world --------------------------------------------------------------------------

/** A tile rectangle in world px. */
export function tileRectWorld(rect: TileRect): WorldRect {
  return { x: rect.col * TILE_WORLD_PX, y: rect.row * TILE_WORLD_PX, w: rect.cols * TILE_WORLD_PX, h: rect.rows * TILE_WORLD_PX };
}

/** A standing piece's box in world px, or null for a piece this build doesn't know. */
export function pieceWorldRect(piece: StandingPiece): WorldRect | null {
  const rect = standingRect(piece);
  return rect ? tileRectWorld(rect) : null;
}

/** The tiles every named plot's pieces cover: pillars for the roam beside the signposts. */
export function plotPieceTiles(plots: readonly Pick<PlotView, 'ground' | 'pieces'>[]): TilePoint[] {
  return plots.filter((p) => p.ground !== null).flatMap((p) => standingTiles(p.pieces));
}

/** What floats over the signpost after a take-down: the refund's total, "+450", as a take-all's; null for an unknown piece. */
export function refundFloat(pieceId: string): string | null {
  const def = pieceDef(pieceId);
  if (!def?.cost) return null;
  return `+${def.cost.reduce((s, c) => s + c.quantity, 0)}`;
}

// --- The building moment -----------------------------------------------------------------

/** The dust's share of the building moment: the first quarter, then the piece rises row by row over the rest. */
export const BUILD_DUST_SHARE = 0.25;

/** How far the building moment has come at `elapsedMs`: dust first, then the rows of the piece's box risen from its base. */
export interface BuildPhase {
  dust: boolean;
  /** Rows of the box drawn, from the base: 0..rows. */
  risen: number;
  done: boolean;
}

export function buildPhase(t: Pick<PlotsTuning, 'buildMs'>, elapsedMs: number, rows: number): BuildPhase {
  const total = Math.max(1, t.buildMs);
  const e = Math.max(0, elapsedMs);
  if (e >= t.buildMs) return { dust: false, risen: rows, done: true };
  const dustMs = total * BUILD_DUST_SHARE;
  if (e < dustMs) return { dust: true, risen: 0, done: false };
  const share = (e - dustMs) / Math.max(1, total - dustMs);
  return { dust: false, risen: Math.min(rows, Math.floor(share * rows) + 1), done: false };
}
