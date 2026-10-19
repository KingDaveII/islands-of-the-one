import type Phaser from 'phaser';
import {
  plotLine,
  sigilPath,
  type HoldingLayout,
  type LayoutPlot,
  type PlotsTuning,
  type PlotView,
  type SigilPath,
  type WritView,
} from '@iot/shared';
import {
  fieldGroundCell,
  fieldGroundRect,
  groundElement,
  lettersBand,
  namedPlotIds,
  plotWorldRect,
  ringPixels,
  ringRect,
  RING_WIDTH,
  sealDurationMs,
  sealPhase,
  sentenceLetters,
  BOARD_SIZE,
  SIGIL_CELL,
  sigilOrigin,
  sigilPoint,
  sigilSegmentsLeft,
  signpostBase,
  signpostBoard,
  signpostTopY,
  SIGNPOST_H,
  SIGNPOST_W,
  WORLD_SCALE,
  type SealPhase,
} from '../game/plotView.js';
import { Palette } from '../palette.js';
import { FIELD_GROUND_TEXTURE } from './sheets.js';
import { DEPTH } from './depth.js';
import { bodyDepth } from './feet.js';
import { rasterize, type LetterSheet } from './letters.js';
import { pixelLine, plot as plotPixels, ring as pixelRing, shadowEllipse } from './pixels.js';

type G = Phaser.GameObjects.Graphics;

/**
 * The plots in the world (docs/design/holding.md "Plots", M2 Task 5), all
 * placeholders in palette tokens until ART draws them: before the island has
 * a Name nothing; after it, an unnamed plot as a faint dotted outline; a
 * named plot with ART's field ground (#123: unsown, sown or faded, one
 * seamless 64 px cell tiled over the plot less the sheet's `inset`, the
 * headland of pale holding ground that keeps the ring and its letters
 * readable; under the props and the Kindled), its seal (the ring round the plot in
 * the Ground's element colour, the sentence's letters from the letter sheet
 * along the top with the divider between the words and at the ring's other
 * join) and its signpost at the centre (a solid 1 × 1 prop y-sorted with the
 * bodies) whose board carries the sigil over a faint 3 × 3 grid (LORE
 * 2026-10-18: the signpost has no words, only the sigil, and loses its line
 * segment by segment while the plot's line is dark, `sigilSegmentsLeft`); a
 * faded plot dim, its board blank.
 * The seal scene on a naming: the ring draws itself round the plot, the
 * letters appear one by one, the sigil traces from its circle to its bar,
 * then the ground turns; whole frames, timed by tuning.json's `plots`, and
 * only once the server's answer has landed. Every colour is a token and
 * nothing fades its alpha.
 */

/** The element's seal colour: earth today (ART's placeholder token). The other elements wait for ART. */
export const ELEMENT_COLORS: Readonly<Record<ReturnType<typeof groundElement>, number>> = {
  earth: Palette.sealEarth,
  water: Palette.sealEarth,
  fire: Palette.sealEarth,
  air: Palette.sealEarth,
};

/** The ink of the letters on the band and the dividers: dark ink over the world (readability.md §4). */
const LETTER_INK: number = Palette.worldInk;

interface DrawnPlot {
  plot: LayoutPlot;
  seal: G;
  /** ART's field ground (#123), tiled over the plot less its headland; its frame is the plot's state. */
  ground: Phaser.GameObjects.TileSprite;
  signpost: G;
  view: PlotView | null;
  /** The seal scene's start (the scene clock), or -1. */
  sealStart: number;
  /** What was last drawn, so a frame redraws only on a change. */
  drawn: string;
  /** The plot's index in the layout: its Writ line is `plotLine(index)`. */
  index: number;
}

/** A plot's state and sentence as the drawing reads them. */
export interface PlotLook {
  letters: string;
  sigil: SigilPath;
  color: number;
  state: PlotView['state'];
}

export function plotLook(view: PlotView): PlotLook {
  const letters = sentenceLetters(view.ground, view.virtue);
  return {
    letters,
    sigil: sigilPath(letters),
    color: ELEMENT_COLORS[groundElement(view.ground)],
    state: view.state,
  };
}

export class PlotsLayer {
  private readonly drawn: DrawnPlot[] = [];
  private sheet: LetterSheet | null = null;
  private named = false;
  /** The scene clock at the last update, for the seal scenes. */
  private now = 0;
  /** The server's clock at the last update and the Writ's lines, for the signposts' fading line. */
  private serverMs = 0;
  private writ: Pick<WritView, 'darkSince' | 'lines'> | null = null;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    readonly layout: HoldingLayout,
    private readonly tuning: () => PlotsTuning,
  ) {
    for (const plot of layout.plots) {
      const seal = scene.add.graphics().setDepth(DEPTH.floor + 0.1);
      // ART's field ground (#123), tiled from the inner rect's corner over the plot less its headland.
      const g = fieldGroundRect(plot);
      const ground = scene.add
        .tileSprite(g.x, g.y, g.w, g.h, FIELD_GROUND_TEXTURE, 'unsown')
        .setOrigin(0, 0)
        .setDepth(DEPTH.roomDoors + 0.25)
        .setVisible(false);
      const base = signpostBase(plot);
      const signpost = scene.add
        .graphics()
        .setPosition(base.x, base.y)
        .setDepth(bodyDepth({ kind: 'prop' }, base.y / WORLD_SCALE))
        .setVisible(false);
      layer.add([seal, ground, signpost]);
      this.drawn.push({ plot, seal, ground, signpost, view: null, sealStart: -1, drawn: '', index: this.drawn.length });
    }
  }

  /** The letter sheet, once loaded: the bands redraw with it. */
  setSheet(sheet: LetterSheet | null): void {
    if (sheet === this.sheet) return;
    this.sheet = sheet;
    for (const d of this.drawn) d.drawn = '';
  }

  /** The latest answer: which plots are named and how (null before any answer; `named` is whether the island has a Name). */
  sync(plots: readonly PlotView[] | null, named: boolean, writ: Pick<WritView, 'darkSince' | 'lines'> | null = null): void {
    this.named = named;
    this.writ = writ;
    for (const d of this.drawn) d.view = plots?.find((p) => p.id === d.plot.id) ?? null;
  }

  /** The named plots' ids, as drawn (the roam makes their signposts pillars). */
  namedIds(): string[] {
    return namedPlotIds({ plots: this.drawn.flatMap((d) => (d.view ? [d.view] : [])) });
  }

  /** Starts the seal scene on a plot: called once the server's answer with the new sentence has landed. */
  startSeal(plotId: string): void {
    const d = this.drawn.find((x) => x.plot.id === plotId);
    if (!d) return;
    d.sealStart = this.now;
    d.drawn = '';
  }

  /** The plot whose seal scene is running, or null. */
  get sealing(): string | null {
    return this.drawn.find((d) => d.sealStart >= 0)?.plot.id ?? null;
  }

  /** Where the floats rise from over a plot (world px): above its signpost; null for a plot without one (unnamed). */
  signpostTop(plotId: string): { x: number; y: number } | null {
    const d = this.drawn.find((x) => x.plot.id === plotId);
    if (!d?.view || d.view.ground === null) return null;
    return { x: signpostBase(d.plot).x, y: signpostTopY(d.plot) - 2 };
  }

  /** Every frame: the seal scenes move on and anything changed redraws. */
  update(nowMs: number, serverMs: number = nowMs): void {
    this.now = nowMs;
    this.serverMs = serverMs;
    for (const d of this.drawn) this.draw(d);
  }

  private phaseOf(d: DrawnPlot, look: PlotLook): SealPhase | null {
    if (d.sealStart < 0) return null;
    const letterCount = Array.from(look.letters).filter((c) => /\p{L}/u.test(c)).length;
    const phase = sealPhase(
      this.tuning(),
      this.now - d.sealStart,
      letterCount,
      look.sigil.steps.length,
    );
    if (this.now - d.sealStart >= sealDurationMs(this.tuning(), letterCount)) d.sealStart = -1;
    return phase;
  }

  private draw(d: DrawnPlot): void {
    const view = this.named ? d.view : null;
    const look = view && view.ground !== null ? plotLook(view) : null;
    const phase = look ? this.phaseOf(d, look) : null;
    const left = look ? this.segmentsLeft(d, look) : 0;
    const key = JSON.stringify([this.named, view, this.sheet !== null, phase, left]);
    if (key === d.drawn) return;
    d.drawn = key;
    const g = d.seal;
    g.clear();
    d.ground.setVisible(false);
    d.signpost.setVisible(false);
    if (!this.named) return;
    const rect = plotWorldRect(d.plot);
    if (!look) {
      // Unnamed: a faint dotted outline, the plot's placeholder until ART.
      const x1 = rect.x + rect.w - 1;
      const y1 = rect.y + rect.h - 1;
      pixelLine(g, rect.x, rect.y, x1, rect.y, Palette.plotOutline, 2);
      pixelLine(g, x1, rect.y, x1, y1, Palette.plotOutline, 2);
      pixelLine(g, x1, y1, rect.x, y1, Palette.plotOutline, 2);
      pixelLine(g, rect.x, y1, rect.x, rect.y, Palette.plotOutline, 2);
      return;
    }
    const faded = look.state === 'faded';
    const ringColor = faded ? Palette.plotFaded : look.color;
    // The ground (ART's cell for the plot's state), turned from the top as the scene ends (only its top share shown),
    // whole, or faded with its line.
    const cell = fieldGroundCell({ state: look.state, sownAt: view?.sownAt ?? null });
    if (d.ground.frame.name !== cell) d.ground.setFrame(cell);
    const inner = fieldGroundRect(d.plot);
    const groundShare = phase ? phase.ground : 1;
    d.ground.setSize(inner.w, Math.max(1, Math.round(inner.h * groundShare))).setVisible(groundShare > 0);
    // The ring draws itself round the plot, clockwise from its top-left corner.
    const pixels = ringPixels(ringRect(d.plot), RING_WIDTH);
    const shown = phase ? Math.floor(pixels.length * phase.ring) : pixels.length;
    plotPixels(g, pixels.slice(0, shown), 0, 0, ringColor);
    // The letters along the top of the ring, one by one, with the divider between the words; the ring's other join
    // carries a divider too (LORE), under the bottom band.
    if (this.sheet && look.letters !== '') {
      const r = rasterize(this.sheet, look.letters);
      const band = lettersBand(d.plot, r.width);
      const letterCount = r.shape.glyphs.length;
      const lettersShown = phase ? Math.min(letterCount, phase.letters) : letterCount;
      const ink = faded ? Palette.plotFaded : LETTER_INK;
      plotRaster(g, r, band.x, band.y, WORLD_SCALE, lettersShown, ink);
      if (lettersShown === letterCount && r.shape.dividers.length > 0) {
        const ringR = ringRect(d.plot);
        const dx = Math.round(ringR.x + ringR.w / 2);
        const dy = ringR.y + ringR.h - RING_WIDTH - 2 - WORLD_SCALE * 2;
        g.fillStyle(ink, 1).fillRect(dx - WORLD_SCALE / 2, dy, WORLD_SCALE, WORLD_SCALE);
      }
    }
    // The signpost at the centre, its board carrying the sigil over a faint grid, traced from its circle to its bar in
    // the seal scene and losing segments while the line is dark; blank once faded.
    this.drawSignpost(d, faded);
    if (!faded && (phase === null || phase.ring >= 1))
      this.drawSigil(d, look, phase ? Math.min(phase.sigil, left) : left, phase ? phase.letters : null);
  }

  /** The sigil's segments the signpost still shows: all while lit, fewer while its line is dark, none once faded. */
  private segmentsLeft(d: DrawnPlot, look: PlotLook): number {
    const segments = Math.max(0, look.sigil.steps.length - 1);
    const line = this.writ?.lines[plotLine(d.index) - 1];
    const darkSince = this.writ?.darkSince ? Date.parse(this.writ.darkSince) : null;
    return sigilSegmentsLeft(segments, line && { state: line.state, fadesAt: Date.parse(line.fadesAt) }, darkSince, this.serverMs);
  }

  /** The sigil on the signpost's board, drawn into its graphics (positioned at the signpost's base). */
  private drawSigil(d: DrawnPlot, look: PlotLook, traced: number, lettersShown: number | null): void {
    const g = d.signpost;
    const base = signpostBase(d.plot);
    const at = sigilOrigin(d.plot);
    const origin = { x: Math.round(at.x - base.x), y: Math.round(at.y - base.y) };
    const grid = Palette.plotGrid;
    for (let i = 0; i <= 3; i++) {
      pixelLine(
        g,
        origin.x,
        origin.y + i * SIGIL_CELL,
        origin.x + 3 * SIGIL_CELL,
        origin.y + i * SIGIL_CELL,
        grid,
        2,
      );
      pixelLine(
        g,
        origin.x + i * SIGIL_CELL,
        origin.y,
        origin.x + i * SIGIL_CELL,
        origin.y + 3 * SIGIL_CELL,
        grid,
        2,
      );
    }
    const steps = look.sigil.steps;
    if (steps.length === 0) return;
    // The sigil waits for the letters to be on the band.
    if (
      lettersShown !== null &&
      lettersShown < Array.from(look.letters).filter((c) => /\p{L}/u.test(c)).length
    )
      return;
    const points = steps.map((s) => sigilPoint(origin, s));
    const segments = points.length - 1;
    const share = traced;
    const color = look.color;
    const first = points[0];
    if (!first) return;
    // The circle where the sentence begins (it stays while the line erodes from its far end).
    pixelRing(g, first.x, first.y, 2, color);
    for (let i = 0; i < segments; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (!a || !b) break;
      const part = Math.max(0, Math.min(1, share - i));
      if (part <= 0) break;
      const end = {
        x: Math.round(a.x + (b.x - a.x) * part),
        y: Math.round(a.y + (b.y - a.y) * part),
      };
      // Earth: heavy and straight, 2 px. (The other elements' lines wait for ART.)
      if (a.x !== end.x || a.y !== end.y) pixelLine(g, a.x, a.y, end.x, end.y, color, 1, 2);
    }
    // The loops and hooks at their steps, as the line reaches them.
    for (const mark of look.sigil.marks) {
      if (mark.step > share) continue;
      const p = points[mark.step];
      if (!p) continue;
      if (mark.kind === 'loop') pixelRing(g, p.x, p.y, 2, color);
      else if (mark.kind === 'hook') g.fillStyle(color, 1).fillRect(p.x + 2, p.y - 4, 2, 3);
    }
    // The bar where it ends, perpendicular to the last segment (across it when the line stands still).
    if (share >= segments) {
      const last = points[points.length - 1];
      if (!last) return;
      const prev = points[points.length - 2] ?? last;
      const horizontal = Math.abs(last.y - prev.y) >= Math.abs(last.x - prev.x);
      g.fillStyle(color, 1);
      if (horizontal) g.fillRect(last.x - 3, last.y - 1, 6, 2);
      else g.fillRect(last.x - 1, last.y - 3, 2, 6);
    }
  }

  private drawSignpost(d: DrawnPlot, faded: boolean): void {
    const g = d.signpost;
    g.clear();
    g.setVisible(true);
    const post = faded ? Palette.plotFaded : Palette.signpostWood;
    const plaque = faded ? Palette.plotFaded : Palette.signpostPlaque;
    const base = signpostBase(d.plot);
    const x0 = -Math.floor(SIGNPOST_W / 2);
    // The post, outlined, then the square board on top of it, outlined: the sigil is drawn onto the board.
    g.fillStyle(Palette.playerOutline, 1).fillRect(x0 - 1, -SIGNPOST_H, SIGNPOST_W + 2, SIGNPOST_H);
    g.fillStyle(post, 1).fillRect(x0, -SIGNPOST_H, SIGNPOST_W, SIGNPOST_H);
    const board = signpostBoard(d.plot);
    const bx = board.x - base.x;
    const by = board.y - base.y;
    g.fillStyle(Palette.playerOutline, 1).fillRect(bx - 1, by - 1, BOARD_SIZE + 2, BOARD_SIZE + 2);
    g.fillStyle(plaque, 1).fillRect(bx, by, BOARD_SIZE, BOARD_SIZE);
    // The grounding shadow under it, by the prop rule's small case (3 high under 16 wide).
    shadowEllipse(d.seal, Math.round(base.x) - 6, Math.round(base.y) - 1, 12, 3);
  }

  /** What the playtests read: each plot's drawn state and the seal scene's phase. */
  snapshot(): {
    id: string;
    drawn: 'none' | 'outline' | 'named' | 'faded';
    sealing: boolean;
    letters: string;
  }[] {
    return this.drawn.map((d) => {
      const view = this.named ? d.view : null;
      const drawn = !this.named
        ? 'none'
        : !view || view.ground === null
          ? 'outline'
          : view.state === 'faded'
            ? 'faded'
            : 'named';
      return {
        id: d.plot.id,
        drawn,
        sealing: d.sealStart >= 0,
        letters: view ? sentenceLetters(view.ground, view.virtue) : '',
      };
    });
  }

  destroy(): void {
    for (const d of this.drawn) {
      d.seal.destroy();
      d.ground.destroy();
      d.signpost.destroy();
    }
  }
}

/**
 * Draws a rasterized string with its left edge at (x, y) at `scale` world px
 * per sheet px, in one colour, the first `shown` letters only (the letters
 * count from the right, as written) and the dividers once both their words
 * are shown.
 */
export function plotRaster(
  g: G,
  r: ReturnType<typeof rasterize>,
  x: number,
  y: number,
  scale: number,
  shown: number,
  color: number,
): void {
  const ranges = r.shape.glyphs
    .filter((gl) => gl.index < shown)
    .map((gl) => [gl.x, gl.x + gl.width] as const);
  for (const d of r.shape.dividers) {
    // A divider shows when the word after it (to its left) has started.
    if (r.shape.glyphs.some((gl) => gl.index < shown && gl.x + gl.width <= d.x))
      ranges.push([d.x, d.x + d.width]);
  }
  const inShown = (col: number): boolean => ranges.some(([a, b]) => col >= a && col < b);
  g.fillStyle(color, 1);
  for (let row = 0; row < r.height; row++) {
    for (let col = 0; col < r.width;) {
      if (r.px[row * r.width + col] === 0 || !inShown(col)) {
        col++;
        continue;
      }
      let end = col;
      while (end < r.width && r.px[row * r.width + end] !== 0 && inShown(end)) end++;
      g.fillRect(x + col * scale, y + row * scale, (end - col) * scale, scale);
      col = end;
    }
  }
}
