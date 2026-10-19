import type Phaser from 'phaser';
import {
  PIECE_SHADOWS,
  pieceAnim,
  pieceDef,
  TILE_SIZE_PX,
  type HoldingLayout,
  type LayoutPlot,
  type PlotsTuning,
  type PlotView,
  type SpriteSheet,
  type StandingPiece,
  type TileRect,
} from '@iot/shared';
import { buildPhase, ghostRect, pieceInitials, pieceWorldRect, TILE_WORLD_PX, tileRectWorld, type Ghost } from '../game/buildView.js';
import { plotWorldRect, type WorldRect } from '../game/plotView.js';
import { Palette } from '../palette.js';
import { DEPTH } from './depth.js';
import { bodyDepth } from './feet.js';
import { checkerMask, maskTop, opaqueMask, outlineMask, OUTLINE_PX, pieceSheetName, riseCrop, riseSteps, unionMask, type Mask, type RiseArt } from './pieceArt.js';
import { shadowEllipse } from './pixels.js';
import { propShadowSizes, type ShadowSize } from './propShadow.js';
import { animKey, optionalSheet, texturePixels } from './spriteSheets.js';
import { place, worldWord, type Text } from './text.js';
import { ditherRect } from './ui.js';

type G = Phaser.GameObjects.Graphics;

/** The placeholder box's height above its footprint (world px): a low prop, so the signpost and the Kindled read over it. */
const BOX_RISE = 10;
/** How many dust pixels the building moment scatters round the base, and how far (world px). */
const DUST_COUNT = 10;
const DUST_SPREAD = 6;

/** A piece drawn from its sheet (ART's #107): the sprite, its row, what the rise and the outline read. */
interface PieceArt {
  sheet: string;
  data: SpriteSheet;
  /** `idle`, or `idle_turned` at 90° and 270° (`pieceAnim`). */
  anim: string;
  sprite: Phaser.GameObjects.Sprite;
  /** The selection outline round the row's silhouette (made on first selection), or null. */
  outline: Phaser.GameObjects.Image | null;
  rise: RiseArt;
  shadow: ShadowSize;
}

/** A standing piece as drawn: its plot, the piece, its footprint, whether its plot is faded (dim), and its art or its placeholder box. */
interface DrawnPiece {
  plotId: string;
  piece: StandingPiece;
  rect: TileRect;
  world: WorldRect;
  dim: boolean;
  /** The placeholder box (and nothing once the piece has its art). */
  g: G;
  /** The placeholder's initials; null for a piece drawn from its sheet. */
  initials: Text | null;
  art: PieceArt | null;
  /** Steps shown of the building moment's rise (all of them once it is over). */
  risen: number;
}

/** The building moment running on a piece: which, and when it started (the scene clock). */
interface Building {
  plotId: string;
  pieceId: string;
  startMs: number;
}

/** The base of a footprint in world px: its bottom centre, where a piece's sheet origin stands (sprites.md §4). */
function footprintBase(world: WorldRect): { x: number; y: number } {
  return { x: world.x + world.w / 2, y: world.y + world.h };
}

/**
 * The upgrade pieces in the world (docs/design/holding.md "Build mode", M2
 * Task 6). A piece whose sheet is on disk (`PIECE_SHEETS`, ART's #107) is a
 * sprite from it, its origin on the bottom centre of its footprint as it
 * lies: `idle`, or `idle_turned` at 90° and 270° (`pieceAnim`), the
 * threshing floor's chaff looping at its sheet's 6 fps; the prop rule's
 * grounding shadow under the seed jars only (`PIECE_SHADOWS`); y-sorted with
 * the bodies by its base. A faded plot's pieces are frozen on their first
 * frame under a 50 % checkerboard of the faded token. Selected in build
 * mode, a 2 px outline in the focus token follows the row's silhouette (ART
 * on #106). The ghost is the piece's own pixels as a 50 % checkerboard of
 * ART's tint (wheel-patina where it fits, choir-flame-deep where it doesn't)
 * with a 1 px outline round each of its tiles, never an alpha fade. The
 * building moment, whole frames timed by tuning.json's `plots.buildMs`: a
 * few dust pixels round the base, then the art rising from its base a tile
 * at a time (`riseCrop`). A piece without its sheet keeps the placeholder:
 * a footprint-sized box with its initials as a word over the world. The
 * build plot's ring is on the ground while build mode is open. Nothing draws
 * before the server's answer.
 */
export class PiecesLayer {
  private drawn: DrawnPiece[] = [];
  private readonly ghostG: G;
  private readonly ringG: G;
  private readonly dustG: G;
  /** The grounding shadows of the pieces drawn from their sheets, on the floor. */
  private readonly shadowG: G;
  /** The ghost's art (the piece's checkerboard), when its piece has a sheet. */
  private readonly ghostImage: Phaser.GameObjects.Image;
  private ghost: { rect: TileRect; fits: boolean; art: boolean } | null = null;
  private ghostKey = '';
  private buildPlot: LayoutPlot | null = null;
  private building: Building | null = null;
  private now = 0;
  private synced = '';
  /** The standing piece selected in build mode (GAME DESIGN 2026-10-19: picking it highlights it in the world). */
  private selected: { plotId: string; pieceId: string } | null = null;
  /** Each sheet's pixels and shadows, read once. */
  private readonly sheetPixels = new Map<string, { img: ImageData; shadows: Map<string, ShadowSize> } | null>();

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
    this.shadowG = scene.add.graphics().setDepth(DEPTH.floor + 0.3);
    this.dustG = scene.add.graphics().setDepth(DEPTH.fx);
    this.ghostG = scene.add.graphics().setDepth(DEPTH.overlay);
    this.ghostImage = scene.add.image(0, 0, '__DEFAULT').setDepth(DEPTH.overlay).setVisible(false);
    worldLayer.add([this.ringG, this.shadowG, this.dustG, this.ghostImage, this.ghostG]);
  }

  /** A piece's sheet when it is on disk and loaded, else undefined (its placeholder draws). */
  private sheetOf(pieceId: string): { name: string; data: SpriteSheet } | undefined {
    const name = pieceSheetName(pieceId);
    const data = name ? optionalSheet(name) : undefined;
    return name && data && this.scene.textures.exists(name) ? { name, data } : undefined;
  }

  /** A sheet's pixels (null without a canvas, as in the unit tests: the art then draws without its masks). */
  private pixels(sheet: string, data: SpriteSheet): { img: ImageData; shadows: Map<string, ShadowSize> } | null {
    if (!this.sheetPixels.has(sheet)) {
      const img = texturePixels(this.scene, sheet);
      this.sheetPixels.set(sheet, img ? { img, shadows: propShadowSizes(data, img) } : null);
    }
    return this.sheetPixels.get(sheet) ?? null;
  }

  /** The opaque pixels of each frame of a sheet's row. */
  private rowMasks(sheet: string, data: SpriteSheet, anim: string): Mask[] {
    const px = this.pixels(sheet, data);
    const frames = data.anims[anim]?.frames ?? [];
    return px ? frames.flatMap((f) => (data.frames[f] ? [opaqueMask(px.img, data.frames[f].frame)] : [])) : [];
  }

  /**
   * A canvas texture made once from a mask: its set pixels in `color`, over the frame's own pixels when `under` names
   * the frame (the faded dim). Returns the key, or null without a canvas.
   */
  private maskTexture(key: string, mask: Mask, color: number, under?: { sheet: string; frame: string }): string | null {
    if (this.scene.textures.exists(key)) return key;
    const canvas = this.scene.textures.createCanvas(key, mask.w, mask.h);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return null;
    if (under) {
      const f = this.scene.textures.getFrame(under.sheet, under.frame);
      const src = this.scene.textures.get(under.sheet).getSourceImage();
      if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement)
        ctx.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, mask.w, mask.h);
    }
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.bits[y * mask.w + x]) ctx.fillRect(x, y, 1, 1);
    canvas.refresh();
    return key;
  }

  /** The art of a standing piece from its sheet, or null for the placeholder. */
  private makeArt(piece: StandingPiece, world: WorldRect, dim: boolean, depth: number): PieceArt | null {
    const sheet = this.sheetOf(piece.pieceId);
    if (!sheet) return null;
    const { name, data } = sheet;
    const anim = pieceAnim(piece.rotation, Boolean(data.anims.idle_turned));
    const first = data.anims[anim]?.frames[0] ?? `${anim}_0`;
    const base = footprintBase(world);
    const sprite = this.scene.add.sprite(base.x, base.y, name, first).setDepth(depth);
    const { origin, cell } = data.meta;
    const masks = this.rowMasks(name, data, anim);
    const firstMask = masks[0];
    if (dim && firstMask) {
      // Frozen with its plot, dim: its first frame under a 50 % checkerboard of the faded token.
      const key = this.maskTexture(`${name}/${first}#faded`, checkerMask(firstMask), Palette.plotFaded, { sheet: name, frame: first });
      if (key) sprite.setTexture(key);
    } else if (!dim && (data.anims[anim]?.frames.length ?? 0) > 1 && this.scene.anims.exists(animKey(name, anim))) {
      sprite.play(animKey(name, anim));
    }
    sprite.setOrigin(origin.x / cell.w, origin.y / cell.h);
    this.worldLayer.add(sprite);
    const px = this.pixels(name, data);
    return {
      sheet: name,
      data,
      anim,
      sprite,
      outline: null,
      rise: { originY: origin.y, cellH: cell.h, top: firstMask ? maskTop(unionMask(masks)) : 0 },
      shadow: PIECE_SHADOWS[piece.pieceId as keyof typeof PIECE_SHADOWS] && px ? (px.shadows.get(first) ?? { w: 0, h: 0 }) : { w: 0, h: 0 },
    };
  }

  /** The selection outline of a piece's art: made once per sheet row, round the union of the row's frames. */
  private outlineOf(d: DrawnPiece, art: PieceArt): Phaser.GameObjects.Image | null {
    if (art.outline) return art.outline;
    const masks = this.rowMasks(art.sheet, art.data, art.anim);
    if (masks.length === 0) return null;
    const ring = outlineMask(unionMask(masks));
    const key = this.maskTexture(`${art.sheet}/${art.anim}#outline`, ring, Palette.uiFocus);
    if (!key) return null;
    const { origin } = art.data.meta;
    const base = footprintBase(d.world);
    art.outline = this.scene.add
      .image(base.x, base.y, key)
      .setOrigin((origin.x + OUTLINE_PX) / ring.w, (origin.y + OUTLINE_PX) / ring.h)
      .setDepth(art.sprite.depth - DEPTH.perPixel / 2);
    this.worldLayer.add(art.outline);
    return art.outline;
  }

  /** How many steps a piece's building moment rises in: its art's tiles, or the box's rows. */
  private steps(d: DrawnPiece): number {
    return d.art ? riseSteps(d.art.rise) : d.rect.rows;
  }

  private clearDrawn(): void {
    for (const d of this.drawn) {
      d.g.destroy();
      d.initials?.destroy();
      d.art?.sprite.destroy();
      d.art?.outline?.destroy();
    }
    this.drawn = [];
  }

  /** The latest answer's plots: the pieces standing in each, and whether the plot is faded. */
  sync(plots: readonly PlotView[]): void {
    const key = JSON.stringify(plots.map((p) => [p.id, p.state === 'faded', p.pieces]));
    if (key === this.synced) return;
    this.synced = key;
    this.clearDrawn();
    for (const plot of plots) {
      if (plot.ground === null) continue;
      for (const piece of plot.pieces) {
        const world = pieceWorldRect(piece);
        const def = pieceDef(piece.pieceId);
        if (!world || !def) continue;
        const rect: TileRect = { col: piece.col, row: piece.row, cols: world.w / TILE_WORLD_PX, rows: world.h / TILE_WORLD_PX };
        const dim = plot.state === 'faded';
        // The base line in sim px: the bottom of the footprint.
        const depth = bodyDepth({ kind: 'prop' }, (rect.row + rect.rows) * TILE_SIZE_PX);
        const g = this.scene.add.graphics().setDepth(depth);
        this.worldLayer.add(g);
        const art = this.makeArt(piece, world, dim, depth);
        let initials: Text | null = null;
        if (!art) {
          initials = worldWord(this.scene, 0, 0, pieceInitials(def.name)).setDepth(DEPTH.floaters);
          this.hudLayer.add(initials);
        }
        const d: DrawnPiece = { plotId: plot.id, piece, rect, world, dim, g, initials, art, risen: 0 };
        d.risen = this.steps(d);
        this.drawn.push(d);
      }
    }
    for (const d of this.drawn) this.drawPiece(d, d.risen);
  }

  /** The selected standing piece, outlined in the focus token until it is dropped, moved or taken down; null clears it. */
  setSelected(plotId: string | null, pieceId: string | null): void {
    const next = plotId && pieceId ? { plotId, pieceId } : null;
    if (JSON.stringify(next) === JSON.stringify(this.selected)) return;
    this.selected = next;
    for (const d of this.drawn) this.drawPiece(d, d.risen);
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

  /** The ghost's art: the piece's first frame in its row as a checkerboard of the tint, or null for the placeholder box. */
  private ghostTexture(ghost: Ghost, fits: boolean): { key: string; data: SpriteSheet } | null {
    const sheet = this.sheetOf(ghost.pieceId);
    if (!sheet) return null;
    const anim = pieceAnim(ghost.rotation, Boolean(sheet.data.anims.idle_turned));
    const mask = this.rowMasks(sheet.name, sheet.data, anim)[0];
    if (!mask) return null;
    const tint = fits ? Palette.ghostFits : Palette.ghostBlocked;
    const key = this.maskTexture(`${sheet.name}/${anim}#ghost-${fits ? 'fits' : 'blocked'}`, checkerMask(mask), tint);
    return key ? { key, data: sheet.data } : null;
  }

  /** The ghost: a footprint and whether it fits (green) or not (red); null drops it. */
  setGhost(ghost: Ghost | null, fits = false): void {
    const rect = ghost ? ghostRect(ghost) : null;
    const key = JSON.stringify(ghost && rect ? { rect, fits, rotation: ghost.rotation, pieceId: ghost.pieceId } : null);
    if (key === this.ghostKey) return;
    this.ghostKey = key;
    this.ghostG.clear();
    this.ghostImage.setVisible(false);
    if (!ghost || !rect) {
      this.ghost = null;
      return;
    }
    const tint = fits ? Palette.ghostFits : Palette.ghostBlocked;
    const world = tileRectWorld(rect);
    const art = this.ghostTexture(ghost, fits);
    this.ghost = { rect, fits, art: art !== null };
    if (art) {
      // The piece's own pixels as a 50 % checkerboard of the tint (ART, #102), standing where the piece would.
      const base = footprintBase(world);
      const { origin, cell } = art.data.meta;
      this.ghostImage.setTexture(art.key).setOrigin(origin.x / cell.w, origin.y / cell.h).setPosition(base.x, base.y).setVisible(true);
    } else {
      // The placeholder box's pixels as the checkerboard.
      ditherRect(this.ghostG, world.x, world.y - BOX_RISE, world.w, world.h + BOX_RISE, tint);
    }
    // The footprint's tiles, each a 1 px outline in the same tint.
    this.ghostG.fillStyle(tint, 1);
    for (let r = 0; r < rect.rows; r++)
      for (let c = 0; c < rect.cols; c++) {
        const x = world.x + c * TILE_WORLD_PX;
        const y = world.y + r * TILE_WORLD_PX;
        this.ghostG.fillRect(x, y, TILE_WORLD_PX, 1).fillRect(x, y + TILE_WORLD_PX - 1, TILE_WORLD_PX, 1);
        this.ghostG.fillRect(x, y, 1, TILE_WORLD_PX).fillRect(x + TILE_WORLD_PX - 1, y, 1, TILE_WORLD_PX);
      }
  }

  /** The ghost as drawn (playtests), or null. */
  ghostState(): { rect: TileRect; fits: boolean; art: boolean } | null {
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

  private isSelected(d: DrawnPiece): boolean {
    return this.selected?.plotId === d.plotId && this.selected.pieceId === d.piece.pieceId;
  }

  /** Draws a standing piece `risen` steps into its rise (all of them once built): its art, or the placeholder box. */
  private drawPiece(d: DrawnPiece, risen: number): void {
    d.risen = Math.max(0, Math.min(this.steps(d), risen));
    if (d.art) this.drawArt(d, d.art);
    else this.drawBox(d);
    this.drawShadows();
  }

  /** A piece from its sheet: cropped to the rows risen so far, its outline while selected and whole. */
  private drawArt(d: DrawnPiece, art: PieceArt): void {
    const crop = riseCrop(art.rise, d.risen);
    const whole = d.risen >= riseSteps(art.rise);
    art.sprite.setVisible(crop.h > 0);
    if (whole) art.sprite.setCrop();
    else art.sprite.setCrop(0, crop.y, art.data.meta.cell.w, crop.h);
    const picked = whole && this.isSelected(d);
    const outline = picked ? this.outlineOf(d, art) : art.outline;
    outline?.setVisible(picked);
  }

  /** The placeholder box: the front face, the top face above it, the outline round both; `d.risen` rows from the base. */
  private drawBox(d: DrawnPiece): void {
    const g = d.g;
    g.clear();
    const { world } = d;
    const face = d.dim ? Palette.plotFaded : Palette.pieceFace;
    const shade = d.dim ? Palette.plotFaded : Palette.pieceShade;
    const rowsShown = d.risen;
    g.setVisible(rowsShown > 0);
    d.initials?.setVisible(rowsShown >= d.rect.rows);
    if (rowsShown === 0) return;
    // The rows rise from the base: only the bottom `rowsShown` tile rows (and the box's top above the first of them) draw.
    const top = world.y + world.h - rowsShown * TILE_WORLD_PX;
    const h = rowsShown * TILE_WORLD_PX;
    // The selected piece's outline in the focus token, 2 px, so it reads in the world.
    if (this.isSelected(d)) g.fillStyle(Palette.uiFocus, 1).fillRect(world.x - 2, top - BOX_RISE - 2, world.w + 4, h + BOX_RISE + 4);
    g.fillStyle(Palette.playerOutline, 1).fillRect(world.x - 1, top - BOX_RISE - 1, world.w + 2, h + BOX_RISE + 2);
    g.fillStyle(face, 1).fillRect(world.x, top - BOX_RISE, world.w, h);
    g.fillStyle(shade, 1).fillRect(world.x, top + h - BOX_RISE, world.w, BOX_RISE);
    // The grounding shadow by the prop rule's small case, under the base.
    shadowEllipse(g, world.x + 2, world.y + world.h - 2, world.w - 4, 3);
  }

  /** The grounding shadows of the pieces drawn from their sheets (the jars'), once their art shows. */
  private drawShadows(): void {
    this.shadowG.clear();
    for (const d of this.drawn) {
      const sh = d.art?.shadow;
      if (!sh || sh.w === 0 || d.risen === 0) continue;
      const base = footprintBase(d.world);
      // Centred on the base line, as the holding's props (holdingWorld.ts `shadowAt`).
      shadowEllipse(this.shadowG, base.x - Math.floor(sh.w / 2), base.y - Math.floor(sh.h / 2), sh.w, sh.h);
    }
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
        const phase = buildPhase(this.tuning(), nowMs - b.startMs, this.steps(d));
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
          if (d.risen !== 0) this.drawPiece(d, 0);
        } else {
          if (d.risen !== phase.risen) this.drawPiece(d, phase.risen);
          if (phase.done) this.building = null;
        }
      }
    }
    for (const d of this.drawn) {
      if (!d.initials?.visible) continue;
      const ui = this.worldToUi(d.world.x + d.world.w / 2, d.world.y + d.world.h / 2 - BOX_RISE / 2);
      place(d.initials, ui.x, ui.y, 0.5, 0.5);
    }
  }

  /** What the playtests read: every piece as drawn (from its sheet or its box), the ghost, the building moment. */
  snapshot(): {
    pieces: {
      plotId: string;
      pieceId: string;
      col: number;
      row: number;
      rotation: number;
      dim: boolean;
      visible: boolean;
      art: string | null;
      anim: string | null;
      frame: string | null;
      outlined: boolean;
      x: number;
      y: number;
    }[];
    ghost: { col: number; row: number; cols: number; rows: number; fits: boolean; art: boolean } | null;
    building: string | null;
    buildPlot: string | null;
  } {
    return {
      pieces: this.drawn.map((d) => ({
        plotId: d.plotId,
        pieceId: d.piece.pieceId,
        col: d.piece.col,
        row: d.piece.row,
        rotation: d.piece.rotation,
        dim: d.dim,
        visible: d.art ? d.art.sprite.visible : d.g.visible,
        art: d.art?.sheet ?? null,
        anim: d.art?.anim ?? null,
        frame: d.art ? d.art.sprite.frame.name : null,
        outlined: d.art ? Boolean(d.art.outline?.visible) : this.isSelected(d),
        x: d.art ? d.art.sprite.x : footprintBase(d.world).x,
        y: d.art ? d.art.sprite.y : footprintBase(d.world).y,
      })),
      ghost: this.ghost ? { ...this.ghost.rect, fits: this.ghost.fits, art: this.ghost.art } : null,
      building: this.building?.pieceId ?? null,
      buildPlot: this.buildPlot?.id ?? null,
    };
  }

  destroy(): void {
    this.clearDrawn();
    this.ghostG.destroy();
    this.ghostImage.destroy();
    this.ringG.destroy();
    this.shadowG.destroy();
    this.dustG.destroy();
  }
}
