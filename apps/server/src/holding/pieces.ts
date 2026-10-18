import {
  BUILD_TEXT,
  InventoryReason,
  isAvailablePiece,
  isPieceRotation,
  layoutPlot,
  pieceDef,
  pieceLimit,
  placementProblems,
  PLOT_TEXT,
  plotIndex,
  skillProgress,
  SKILL_NAMES,
  validateUsername,
  type HoldingLayout,
  type PlotPieceRequest,
  type PlotTakeDownRequest,
  type StandingPiece,
  type WritStored,
} from '@iot/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { Database, Transaction } from '../db/client.js';
import { accounts, kindled, plotPieces, skillXp, type PlotPieceRow, type PlotRow } from '../db/schema.js';
import type { Inventory, ItemChange } from '../inventory/index.js';
import { plotKindOf, plotState } from './plots.js';

/**
 * Upgrade pieces on the server (docs/design/holding.md "Build mode", M2 Task
 * 6): the `plot_pieces` rows (one per Kindled, plot and piece kind, read and
 * written only here under the Kindled's lock), building a piece with every
 * refusal in the brief's order (the cost from the store through
 * `inventory.apply`, reason `build`), moving one for free, taking one down
 * with every material back into the store (refused whole when the refund
 * doesn't fit: nothing is ever destroyed), taking a whole plot's pieces down
 * (a Ground-changing rename, the `plots:pieces --clear` CLI; that refund may
 * overfill the store), and the pieces on the wire. The rules are
 * @iot/shared's (`placementProblems`, `pieceLimit`, `plotLevel`).
 */

/** The Kindled's piece rows, locked FOR UPDATE for the rest of the transaction, by plot then piece. Call under the Kindled's own lock. */
export async function lockPieces(tx: Transaction, kindledId: string): Promise<PlotPieceRow[]> {
  return tx
    .select()
    .from(plotPieces)
    .where(eq(plotPieces.kindledId, kindledId))
    .orderBy(asc(plotPieces.plotId), asc(plotPieces.pieceId))
    .for('update');
}

/** A row as the shared rules read it (a rotation the data can't hold reads as 0). */
export function standingOf(row: Pick<PlotPieceRow, 'pieceId' | 'col' | 'row' | 'rotation'>): StandingPiece {
  return { pieceId: row.pieceId, col: row.col, row: row.row, rotation: isPieceRotation(row.rotation) ? row.rotation : 0 };
}

/** The pieces standing in a plot, in piece id order. */
export function piecesOfPlot(rows: readonly PlotPieceRow[], plotId: string): StandingPiece[] {
  return rows.filter((r) => r.plotId === plotId).map(standingOf);
}

export type PieceError =
  | 'unknown-plot'
  | 'unnamed-plot'
  | 'faded'
  | 'unknown-piece'
  | 'already-built'
  | 'needs-line'
  | 'needs-skill'
  | 'limit'
  | 'blocked'
  | 'insufficient'
  | 'not-built'
  | 'store-full';

export type PieceResult = { ok: true } | { ok: false; error: PieceError; message: string };

type Refused = { ok: false; error: PieceError; message: string };
const refuse = (error: PieceError, message: string): Refused => ({ ok: false, error, message });

/** The change set a piece's cost takes from the store (negative), or its refund gives back (positive), one change per item. */
export function costChanges(kindledId: string, cost: readonly { itemId: string; quantity: number }[], sign: 1 | -1): ItemChange[] {
  const merged = new Map<string, number>();
  for (const c of cost) merged.set(c.itemId, (merged.get(c.itemId) ?? 0) + c.quantity);
  return [...merged].map(([itemId, quantity]) => ({ kindledId, itemId, place: 'store' as const, delta: sign * quantity }));
}

/** The refund of a set of standing pieces: every material of every piece, merged per item, back into the store. */
export function refundChanges(kindledId: string, pieces: readonly StandingPiece[]): ItemChange[] {
  const cost = pieces.flatMap((p) => {
    const def = pieceDef(p.pieceId);
    return def?.cost ?? [];
  });
  return costChanges(kindledId, cost, 1);
}

/**
 * The plot a build route names, or its refusal: `unknown-plot`,
 * `unnamed-plot`, `faded` (frozen with its pieces), in that order.
 */
function plotOf(
  layout: HoldingLayout,
  writ: WritStored,
  plotRows: readonly PlotRow[],
  plotId: string,
  now: Date,
): { ok: true; index: number; kind: string } | Refused {
  const index = plotIndex(layout, plotId);
  if (index < 0 || !layoutPlot(layout, plotId)) return refuse('unknown-plot', PLOT_TEXT.UNKNOWN_PLOT);
  const row = plotRows.find((r) => r.plotId === plotId);
  const kind = row ? plotKindOf(row) : undefined;
  if (!row || !kind) return refuse('unnamed-plot', PLOT_TEXT.UNNAMED_PLOT);
  if (plotState(index, writ, now.getTime()) === 'faded') return refuse('faded', PLOT_TEXT.FADED);
  return { ok: true, index, kind: kind.id };
}

/** A Kindled's level in a skill, read inside the transaction (level 1 without a row). */
async function skillLevel(tx: Transaction, kindledId: string, skill: string): Promise<number> {
  const [row] = await tx
    .select({ xp: skillXp.xp })
    .from(skillXp)
    .where(and(eq(skillXp.kindledId, kindledId), eq(skillXp.skill, skill)));
  return skillProgress(row?.xp ?? 0).level;
}

/**
 * Builds a piece in a named plot, under the Kindled's locks after the settle.
 * The refusals in the brief's order: `unknown-plot`, `unnamed-plot`, `faded`;
 * `unknown-piece` (not in pieces.json, not available, or not this plot's
 * kind); `already-built` (each kind stands once per plot); `needs-line`;
 * `needs-skill`; `limit` (`pieceLimit` pieces stand already); `blocked`
 * (`placementProblems`, the message naming the first reason);
 * `insufficient` (the store lacks the cost; the pack doesn't count). The
 * cost leaves the store through `inventory.apply`, reason `build`.
 */
export async function buildPieceIn(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  writ: WritStored,
  layout: HoldingLayout,
  plotRows: readonly PlotRow[],
  pieceRows: readonly PlotPieceRow[],
  args: PlotPieceRequest,
  now: Date,
): Promise<PieceResult> {
  const plot = plotOf(layout, writ, plotRows, args.plotId, now);
  if (!plot.ok) return plot;
  const def = pieceDef(args.pieceId);
  if (!isAvailablePiece(def) || def.stationKind !== plot.kind) return refuse('unknown-piece', BUILD_TEXT.UNKNOWN_PIECE);
  const standing = piecesOfPlot(pieceRows, args.plotId);
  if (standing.some((p) => p.pieceId === def.id)) return refuse('already-built', BUILD_TEXT.ALREADY_BUILT);
  if (def.writLine > writ.lineCount) return refuse('needs-line', BUILD_TEXT.NEEDS_LINE_REFUSAL(def.writLine));
  if (def.skill && (await skillLevel(tx, kindledId, def.skill.skill)) < def.skill.level)
    return refuse('needs-skill', BUILD_TEXT.NEEDS_SKILL_REFUSAL(SKILL_NAMES[def.skill.skill], def.skill.level));
  if (standing.length >= pieceLimit(writ.lineCount)) return refuse('limit', BUILD_TEXT.LIMIT);
  const layoutPlotDef = layoutPlot(layout, args.plotId);
  if (!layoutPlotDef) return refuse('unknown-plot', PLOT_TEXT.UNKNOWN_PLOT);
  const placement: StandingPiece = { pieceId: def.id, col: args.col, row: args.row, rotation: args.rotation };
  const problems = placementProblems(layout, layoutPlotDef, standing, placement);
  const first = problems[0];
  if (first !== undefined) return refuse('blocked', BUILD_TEXT.BLOCKED_BECAUSE(first));
  const paid = await inventory.apply(costChanges(kindledId, def.cost, -1), InventoryReason.Build, { tx });
  if (!paid.ok) {
    if (paid.error === 'insufficient') return refuse('insufficient', BUILD_TEXT.INSUFFICIENT);
    throw new Error(`build: ${paid.message}`);
  }
  await tx.insert(plotPieces).values({ kindledId, plotId: args.plotId, pieceId: def.id, col: args.col, row: args.row, rotation: args.rotation, builtAt: now });
  return { ok: true };
}

/**
 * Moves a standing piece, for free: `unknown-plot`, `unnamed-plot`, `faded`,
 * `not-built`, `blocked` (the piece doesn't block itself).
 */
export async function movePieceIn(
  tx: Transaction,
  kindledId: string,
  writ: WritStored,
  layout: HoldingLayout,
  plotRows: readonly PlotRow[],
  pieceRows: readonly PlotPieceRow[],
  args: PlotPieceRequest,
  now: Date,
): Promise<PieceResult> {
  const plot = plotOf(layout, writ, plotRows, args.plotId, now);
  if (!plot.ok) return plot;
  const standing = piecesOfPlot(pieceRows, args.plotId);
  const def = pieceDef(args.pieceId);
  if (!standing.some((p) => p.pieceId === args.pieceId) || !isAvailablePiece(def)) return refuse('not-built', BUILD_TEXT.NOT_BUILT);
  const layoutPlotDef = layoutPlot(layout, args.plotId);
  if (!layoutPlotDef) return refuse('unknown-plot', PLOT_TEXT.UNKNOWN_PLOT);
  const placement: StandingPiece = { pieceId: def.id, col: args.col, row: args.row, rotation: args.rotation };
  const first = placementProblems(layout, layoutPlotDef, standing, placement)[0];
  if (first !== undefined) return refuse('blocked', BUILD_TEXT.BLOCKED_BECAUSE(first));
  await tx
    .update(plotPieces)
    .set({ col: args.col, row: args.row, rotation: args.rotation })
    .where(and(eq(plotPieces.kindledId, kindledId), eq(plotPieces.plotId, args.plotId), eq(plotPieces.pieceId, def.id)));
  return { ok: true };
}

/**
 * Takes a standing piece down: every material back into the store through
 * `inventory.apply` (reason `build`, positive deltas), or refused whole as
 * `store-full` with the take-all's line when a stack doesn't fit (GAME
 * DESIGN: the piece stays standing; nothing is ever destroyed). Also
 * `unknown-plot`, `unnamed-plot`, `faded`, `not-built`.
 */
export async function takeDownPieceIn(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  writ: WritStored,
  layout: HoldingLayout,
  plotRows: readonly PlotRow[],
  pieceRows: readonly PlotPieceRow[],
  args: PlotTakeDownRequest,
  now: Date,
): Promise<PieceResult> {
  const plot = plotOf(layout, writ, plotRows, args.plotId, now);
  if (!plot.ok) return plot;
  const piece = piecesOfPlot(pieceRows, args.plotId).find((p) => p.pieceId === args.pieceId);
  if (!piece) return refuse('not-built', BUILD_TEXT.NOT_BUILT);
  const refund = refundChanges(kindledId, [piece]);
  if (refund.length > 0) {
    const given = await inventory.apply(refund, InventoryReason.Build, { tx });
    if (!given.ok) {
      if (given.error === 'stack-limit' && given.change) return refuse('store-full', BUILD_TEXT.STORE_FULL(given.change.itemId));
      throw new Error(`take-down: ${given.message}`);
    }
  }
  await tx
    .delete(plotPieces)
    .where(and(eq(plotPieces.kindledId, kindledId), eq(plotPieces.plotId, args.plotId), eq(plotPieces.pieceId, args.pieceId)));
  return { ok: true };
}

/**
 * Takes every piece of a plot down with its refund, which may overfill the
 * store (a Ground-changing rename, in its transaction; the `plots:pieces
 * --clear` CLI): nothing is ever destroyed. Returns the refund given.
 */
export async function takeDownAllIn(
  tx: Transaction,
  inventory: Inventory,
  kindledId: string,
  plotId: string,
  pieceRows: readonly PlotPieceRow[],
): Promise<ItemChange[]> {
  const standing = piecesOfPlot(pieceRows, plotId);
  if (standing.length === 0) return [];
  const refund = refundChanges(kindledId, standing);
  if (refund.length > 0) {
    const given = await inventory.apply(refund, InventoryReason.Build, { tx, overfillStore: true });
    if (!given.ok) throw new Error(`take-down all: ${given.message}`);
  }
  await tx.delete(plotPieces).where(and(eq(plotPieces.kindledId, kindledId), eq(plotPieces.plotId, plotId)));
  return refund;
}

// --- The playtest CLI ---------------------------------------------------------------

export const PIECES_USAGE = 'usage: plots:pieces <username> <plotId> [--clear]   (lists the pieces standing in the plot; --clear takes them all down with their refunds)';

export interface PiecesArgs {
  username: string;
  plotId: string;
  clear: boolean;
}

export function parsePiecesArgs(argv: readonly string[], layout: HoldingLayout): { ok: true; args: PiecesArgs } | { ok: false; message: string } {
  const rest = argv.filter((a) => a !== '--');
  const clear = rest.includes('--clear');
  const positional = rest.filter((a) => a !== '--clear');
  if (positional.length !== 2) return { ok: false, message: PIECES_USAGE };
  const [rawUsername = '', plotId = ''] = positional;
  const username = validateUsername(rawUsername);
  if (!username.ok) return { ok: false, message: `bad username: ${username.message}` };
  if (!layoutPlot(layout, plotId)) return { ok: false, message: `unknown plot ${plotId}; the layout has ${layout.plots.map((p) => p.id).join(', ')}` };
  return { ok: true, args: { username: username.value, plotId, clear } };
}

/** The Kindled of a username, or null. */
export async function kindledOfUsername(db: Database, username: string): Promise<string | null> {
  const [row] = await db
    .select({ kindledId: kindled.id })
    .from(accounts)
    .innerJoin(kindled, eq(kindled.accountId, accounts.id))
    .where(eq(sql`lower(${accounts.username})`, username.toLowerCase()))
    .limit(1);
  return row?.kindledId ?? null;
}

export type PiecesListResult = { ok: true; kindledId: string; pieces: StandingPiece[] } | { ok: false; message: string };

/** `plots:pieces <username> <plotId>`: the pieces standing in the plot. */
export async function listPieces(db: Database, { username, plotId }: Pick<PiecesArgs, 'username' | 'plotId'>): Promise<PiecesListResult> {
  const kindledId = await kindledOfUsername(db, username);
  if (!kindledId) return { ok: false, message: `no Kindled for username ${username}` };
  const rows = await db
    .select()
    .from(plotPieces)
    .where(and(eq(plotPieces.kindledId, kindledId), inArray(plotPieces.plotId, [plotId])))
    .orderBy(asc(plotPieces.pieceId));
  return { ok: true, kindledId, pieces: rows.map(standingOf) };
}
