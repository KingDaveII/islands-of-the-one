import type Phaser from 'phaser';
import { pieceDef, TILE_SIZE_PX, type HoldingLayout, type LayoutPlot, type PlotsTuning, type PlotView, type StandingPiece, type TileRect } from '@iot/shared';
import { buildPhase, ghostRect, pieceInitials, pieceWorldRect, TILE_WORLD_PX, tileRectWorld, type Ghost } from '../game/buildView.js';
import { plotWorldRect, type WorldRect } from '../game/plotView.js';
import { Palette } from '../palette.js';
import { DEPTH } from './depth.js';
import { bodyDepth } from './feet.js';
import { shadowEllipse } from './pixels.js';
import { place, worldWord, type Text } from './text.js';
import { ditherRect } from './ui.js';

type G = Phaser.GameObjects.Graphics;

/** The placeholder box's height above its footprint (world px): a low prop, so the signpost and the Kindled read over it. */
const BOX_RISE = 10;
/** How many dust pixels the building moment scatters round the base, and how far (world px). */
const DUST_COUNT = 10;
const DUST_SPREAD = 6;

/** A standing piece as drawn: its plot, the piece, its box, and whether its plot is faded (dim). */
interface DrawnPiece {
  plotId: string;
  piece: StandingPiece;
  rect: TileRect;
  world: WorldRect;
  dim: boolean;
  g: G;
  initials: Text;
}

/** The building moment running on a piece: which, and when it started (the scene clock). */
interface Building {
  plotId: string;
  pieceId: string;
  startMs: number;
}

/**
 * The upgrade pieces in the world (docs/design/holding.md "Build mode", M2
 * Task 6), placeholders in palette tokens until ART draws them: a standing
 * piece is a footprint-sized box (its face, a shaded front and a 1 px
 * outline) with the piece's initials as a word over the world, y-sorted with
 * the bodies by its base, dim when its plot is faded; the ghost is the same
 * box as a 50 % checkerboard of ART's tint (wheel-patina where it fits,
 * choir-flame-deep where it doesn't) with a 1 px outline round each of its
 * tiles, never an alpha fade; the build plot's ring on the ground while build
 * mode is open; and the building moment on a new piece, whole frames timed
 * by tuning.json's `plots.buildMs`: a few dust pixels round its base, then
 * the box rising from the base row by row. Nothing draws before the server's
 * answer.
 */
export class PiecesLayer {
  private drawn: DrawnPiece[] = [];
  private readonly ghostG: G;
  private readonly ringG: G;
  private readonly dustG: G;
  private ghost: { rect: TileRect; fits: boolean } | null = null;
  private ghostKey = '';
  private buildPlot: LayoutPlot | null = null;
  private building: Building | null = null;
  private now = 0;
  private synced = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldLayer: Phaser.GameObjects.Layer,
    private readonly hudLayer: Phaser.GameObjects.Layer,
    readonly layout: HoldingLayout,
    private readonly tuning: () => PlotsTuning,
    /** A world-px point on the UI grid, for the initials. */
    private readonly worldToUi: (x: number, y: number) => { x: number; y: number },
  ) {
    this.ringG = scene.add.graphics().setDepth(DEPTH.floor + 0.2).setVisible(false);
    this.dustG = scene.add.graphics().setDepth(DEPTH.fx);
    this.ghostG = scene.add.graphics().setDepth(DEPTH.overlay);
    worldLayer.add([this.ringG, this.dustG, this.ghostG]);
  }

  /** The latest answer's plots: the pieces standing in each, and whether the plot is faded. */
  sync(plots: readonly PlotView[]): void {
    const key = JSON.stringify(plots.map((p) => [p.id, p.state === 'faded', p.pieces]));
    if (key === this.synced) return;
    this.synced = key;
    for (const d of this.drawn) {
      d.g.destroy();
      d.initials.destroy();
    }
    this.drawn = [];
    for (const plot of plots) {
      if (plot.ground === null) continue;
      for (const piece of plot.pieces) {
        const world = pieceWorldRect(piece);
        const def = pieceDef(piece.pieceId);
        if (!world || !def) continue;
        const rect: TileRect = { col: piece.col, row: piece.row, cols: world.w / TILE_WORLD_PX, rows: world.h / TILE_WORLD_PX };
        const g = this.scene.add.graphics();
        // The base line in sim px: the bottom of the footprint.
        g.setDepth(bodyDepth({ kind: 'prop' }, (rect.row + rect.rows) * TILE_SIZE_PX));
        this.worldLayer.add(g);
        const initials = worldWord(this.scene, 0, 0, pieceInitials(def.name)).setDepth(DEPTH.floaters);
        this.hudLayer.add(initials);
        this.drawn.push({ plotId: plot.id, piece, rect, world, dim: plot.state === 'faded', g, initials });
      }
    }
    for (const d of this.drawn) this.drawPiece(d, d.rect.rows);
  }

  /** The pieces drawn in a plot, as the scene reads them (a click on one selects it). */
  piecesIn(plotId: string): StandingPiece[] {
    return this.drawn.filter((d) => d.plotId === plotId).map((d) => d.piece);
  }

  /** Build mode's plot: its ring on the ground; null leaves build mode. */
  setBuildPlot(plot: LayoutPlot | null): void {
    this.buildPlot = plot;
    this.ringG.clear();
    this.ringG.setVisible(plot !== null);
    if (!plot) {
      this.setGhost(null);
      return;
    }
    const r = plotWorldRect(plot);
    this.ringG.fillStyle(Palette.buildRing, 1);
    // A 1 px ring round the plot's tiles, dotted every other pixel, on the ground under the props.
    ditherRect(this.ringG, r.x, r.y, r.w, 1, Palette.buildRing);
    ditherRect(this.ringG, r.x, r.y + r.h - 1, r.w, 1, Palette.buildRing);
    ditherRect(this.ringG, r.x, r.y, 1, r.h, Palette.buildRing);
    ditherRect(this.ringG, r.x + r.w - 1, r.y, 1, r.h, Palette.buildRing);
  }

  /** The ghost: a footprint and whether it fits (green) or not (red); null drops it. */
  setGhost(ghost: Ghost | null, fits = false): void {
    const rect = ghost ? ghostRect(ghost) : null;
    const next = rect ? { rect, fits } : null;
    const key = JSON.stringify(next);
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghost = next;
    this.ghostG.clear();
    if (!next) return;
    const tint = next.fits ? Palette.ghostFits : Palette.ghostBlocked;
    const world = tileRectWorld(next.rect);
    // The piece's opaque pixels (its placeholder box) as a 50 % checkerboard of the tint (ART, #102).
    const box = { x: world.x, y: world.y - BOX_RISE, w: world.w, h: world.h + BOX_RISE };
    ditherRect(this.ghostG, box.x, box.y, box.w, box.h, tint);
    // The footprint's tiles, each a 1 px outline in the same tint.
    this.ghostG.fillStyle(tint, 1);
    for (let r = 0; r < next.rect.rows; r++)
      for (let c = 0; c < next.rect.cols; c++) {
        const x = world.x + c * TILE_WORLD_PX;
        const y = world.y + r * TILE_WORLD_PX;
        this.ghostG.fillRect(x, y, TILE_WORLD_PX, 1).fillRect(x, y + TILE_WORLD_PX - 1, TILE_WORLD_PX, 1);
        this.ghostG.fillRect(x, y, 1, TILE_WORLD_PX).fillRect(x + TILE_WORLD_PX - 1, y, 1, TILE_WORLD_PX);
      }
  }

  /** The ghost as drawn (playtests), or null. */
  ghostState(): { rect: TileRect; fits: boolean } | null {
    return this.ghost;
  }

  /** Starts the building moment on a piece: called once the server's answer with it has landed. */
  startBuild(plotId: string, pieceId: string): void {
    this.building = { plotId, pieceId, startMs: this.now };
  }

  /** The piece whose building moment is running, or null. */
  get buildingPiece(): string | null {
    return this.building?.pieceId ?? null;
  }

  /** The box of a standing piece: the front face, the top face above it, the outline round both. `risen` rows from the base are drawn. */
  private drawPiece(d: DrawnPiece, risen: number): void {
    const g = d.g;
    g.clear();
    const { world } = d;
    const face = d.dim ? Palette.plotFaded : Palette.pieceFace;
    const shade = d.dim ? Palette.plotFaded : Palette.pieceShade;
    const rowsShown = Math.max(0, Math.min(d.rect.rows, risen));
    g.setVisible(rowsShown > 0);
    d.initials.setVisible(rowsShown >= d.rect.rows);
    if (rowsShown === 0) return;
    // The rows rise from the base: only the bottom `rowsShown` tile rows (and the box's top above the first of them) draw.
    const top = world.y + world.h - rowsShown * TILE_WORLD_PX;
    const h = rowsShown * TILE_WORLD_PX;
    g.fillStyle(Palette.playerOutline, 1).fillRect(world.x - 1, top - BOX_RISE - 1, world.w + 2, h + BOX_RISE + 2);
    g.fillStyle(face, 1).fillRect(world.x, top - BOX_RISE, world.w, h);
    g.fillStyle(shade, 1).fillRect(world.x, top + h - BOX_RISE, world.w, BOX_RISE);
    // The grounding shadow by the prop rule's small case, under the base.
    shadowEllipse(g, world.x + 2, world.y + world.h - 2, world.w - 4, 3);
  }

  /** Every frame: the building moment moves on, the initials follow the camera. */
  update(nowMs: number): void {
    this.now = nowMs;
    this.dustG.clear();
    const b = this.building;
    if (b) {
      const d = this.drawn.find((x) => x.plotId === b.plotId && x.piece.pieceId === b.pieceId);
      if (!d) this.building = null;
      else {
        const phase = buildPhase(this.tuning(), nowMs - b.startMs, d.rect.rows);
        if (phase.dust) {
          // A few dust pixels round the base, scattered by a fixed pattern (whole pixels, no alpha).
          this.dustG.fillStyle(Palette.buildDust, 1);
          const baseY = d.world.y + d.world.h;
          for (let i = 0; i < DUST_COUNT; i++) {
            const t = (nowMs - b.startMs) / Math.max(1, this.tuning().buildMs * 0.25);
            const x = d.world.x + ((i * 37) % Math.max(1, d.world.w));
            const y = baseY - Math.round(((i * 13) % DUST_SPREAD) * t) - 1;
            this.dustG.fillRect(x, y, 1, 1);
          }
          this.drawPiece(d, 0);
        } else {
          this.drawPiece(d, phase.risen);
          if (phase.done) this.building = null;
        }
      }
    }
    for (const d of this.drawn) {
      if (!d.initials.visible) continue;
      const ui = this.worldToUi(d.world.x + d.world.w / 2, d.world.y + d.world.h / 2 - BOX_RISE / 2);
      place(d.initials, ui.x, ui.y, 0.5, 0.5);
    }
  }

  /** What the playtests read: every piece as drawn, the ghost, the building moment. */
  snapshot(): {
    pieces: { plotId: string; pieceId: string; col: number; row: number; rotation: number; dim: boolean; visible: boolean }[];
    ghost: { col: number; row: number; cols: number; rows: number; fits: boolean } | null;
    building: string | null;
    buildPlot: string | null;
  } {
    return {
      pieces: this.drawn.map((d) => ({ plotId: d.plotId, pieceId: d.piece.pieceId, col: d.piece.col, row: d.piece.row, rotation: d.piece.rotation, dim: d.dim, visible: d.g.visible })),
      ghost: this.ghost ? { ...this.ghost.rect, fits: this.ghost.fits } : null,
      building: this.building?.pieceId ?? null,
      buildPlot: this.buildPlot?.id ?? null,
    };
  }

  destroy(): void {
    for (const d of this.drawn) {
      d.g.destroy();
      d.initials.destroy();
    }
    this.drawn = [];
    this.ghostG.destroy();
    this.ringG.destroy();
    this.dustG.destroy();
  }
}
