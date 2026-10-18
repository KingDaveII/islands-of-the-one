import type Phaser from 'phaser';
import {
  sigilPath,
  type HoldingLayout,
  type LayoutPlot,
  type PlotsTuning,
  type PlotView,
  type SigilPath,
} from '@iot/shared';
import {
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
  SIGIL_CELL,
  sigilOrigin,
  sigilPoint,
  signpostBase,
  SIGNPOST_H,
  SIGNPOST_W,
  WORLD_SCALE,
  type SealPhase,
} from '../game/plotView.js';
import { Palette, type Tokens } from '../palette.js';
import { DEPTH } from './depth.js';
import { bodyDepth } from './feet.js';
import { rasterize, type LetterSheet } from './letters.js';
import { pixelLine, plot as plotPixels, ring as pixelRing, shadowEllipse } from './pixels.js';

type G = Phaser.GameObjects.Graphics;

/**
 * The plots in the world (docs/design/holding.md "Plots", M2 Task 5), all
 * placeholders in palette tokens until ART draws them: before the island has
 * a Name nothing; after it, an unnamed plot as a faint dotted outline; a
 * named plot with its ground turned dark and crumbly (a whole-pixel dither
 * under the props and the Kindled), its seal (the ring round the plot in
 * the Ground's element colour, the sentence's letters from the letter sheet
 * along the top with the divider between the words and at the ring's other
 * join, the sigil at the centre over a faint 3 × 3 grid) and its signpost (a
 * solid 1 × 1 prop y-sorted with the bodies); a faded plot dim with no sigil.
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

/** The ground's dither textures: one for a lit or dark plot, one dim for a faded one. */
const GROUND_KEY = 'plot-ground';
const GROUND_DIM_KEY = 'plot-ground-dim';

/** The ink of the letters on the band and the dividers: dark ink over the world (readability.md §4). */
const LETTER_INK: number = Palette.worldInk;

interface DrawnPlot {
  plot: LayoutPlot;
  seal: G;
  ground: Phaser.GameObjects.Image;
  signpost: G;
  view: PlotView | null;
  /** The seal scene's start (the scene clock), or -1. */
  sealStart: number;
  /** What was last drawn, so a frame redraws only on a change. */
  drawn: string;
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

/** The ground dither on a canvas: one pixel in four of the ink, the pattern fixed in the world (the texture is tiled from the plot's corner). */
function groundTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  ink: keyof typeof Tokens,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = scene.textures.createCanvas(key, w, h);
  const ctx = canvas?.getContext();
  if (!canvas || !ctx) return;
  ctx.fillStyle = `#${Palette[ink === 'hollowBelow' ? 'ground' : 'uiInkMuted'].toString(16).padStart(6, '0')}`;
  for (let y = 0; y < h; y += 2)
    for (let x = (y / 2) % 2 === 0 ? 0 : 2; x < w; x += 4) ctx.fillRect(x, y, 1, 1);
  canvas.refresh();
}

export class PlotsLayer {
  private readonly drawn: DrawnPlot[] = [];
  private sheet: LetterSheet | null = null;
  private named = false;
  /** The scene clock at the last update, for the seal scenes. */
  private now = 0;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    readonly layout: HoldingLayout,
    private readonly tuning: () => PlotsTuning,
  ) {
    const first = layout.plots[0];
    const size = first ? plotWorldRect(first) : { w: 192, h: 192 };
    groundTexture(scene, GROUND_KEY, size.w, size.h, 'hollowBelow');
    groundTexture(scene, GROUND_DIM_KEY, size.w, size.h, 'hollowDusk');
    for (const plot of layout.plots) {
      const r = plotWorldRect(plot);
      const seal = scene.add.graphics().setDepth(DEPTH.floor + 0.1);
      const ground = scene.add
        .image(r.x, r.y, GROUND_KEY)
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
      this.drawn.push({ plot, seal, ground, signpost, view: null, sealStart: -1, drawn: '' });
    }
  }

  /** The letter sheet, once loaded: the bands redraw with it. */
  setSheet(sheet: LetterSheet | null): void {
    if (sheet === this.sheet) return;
    this.sheet = sheet;
    for (const d of this.drawn) d.drawn = '';
  }

  /** The latest answer: which plots are named and how (null before any answer; `named` is whether the island has a Name). */
  sync(plots: readonly PlotView[] | null, named: boolean): void {
    this.named = named;
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
    const base = signpostBase(d.plot);
    return { x: base.x, y: base.y - SIGNPOST_H - 2 };
  }

  /** Every frame: the seal scenes move on and anything changed redraws. */
  update(nowMs: number): void {
    this.now = nowMs;
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
    const key = JSON.stringify([this.named, view, this.sheet !== null, phase]);
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
    // The ground, turned from the top as the scene ends (cropped to its share), whole, or dim once faded.
    d.ground.setTexture(faded ? GROUND_DIM_KEY : GROUND_KEY).setVisible(true);
    const groundShare = phase ? phase.ground : 1;
    d.ground.setCrop(0, 0, rect.w, Math.round(rect.h * groundShare));
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
    // The sigil at the centre over a faint grid, traced from its circle to its bar; none while faded.
    if (!faded && (phase === null || phase.ring >= 1))
      this.drawSigil(g, d.plot, look, phase ? phase.sigil : null, phase ? phase.letters : null);
    // The signpost: a solid 1 × 1 placeholder prop on its tile.
    this.drawSignpost(d, faded);
  }

  private drawSigil(
    g: G,
    plot: LayoutPlot,
    look: PlotLook,
    traced: number | null,
    lettersShown: number | null,
  ): void {
    const origin = sigilOrigin(plot);
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
    const share = traced ?? segments;
    const color = look.color;
    const first = points[0];
    if (!first) return;
    // The circle where the sentence begins.
    pixelRing(g, first.x, first.y, 3, color);
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
      if (mark.kind === 'loop') pixelRing(g, p.x, p.y, 3, color);
      else if (mark.kind === 'hook') g.fillStyle(color, 1).fillRect(p.x + 2, p.y - 5, 2, 4);
    }
    // The bar where it ends, perpendicular to the last segment (across it when the line stands still).
    if (share >= segments) {
      const last = points[points.length - 1];
      if (!last) return;
      const prev = points[points.length - 2] ?? last;
      const horizontal = Math.abs(last.y - prev.y) >= Math.abs(last.x - prev.x);
      g.fillStyle(color, 1);
      if (horizontal) g.fillRect(last.x - 4, last.y - 1, 8, 2);
      else g.fillRect(last.x - 1, last.y - 4, 2, 8);
    }
  }

  private drawSignpost(d: DrawnPlot, faded: boolean): void {
    const g = d.signpost;
    g.clear();
    g.setVisible(true);
    const post = faded ? Palette.plotFaded : Palette.signpostWood;
    const plaque = faded ? Palette.plotFaded : Palette.signpostPlaque;
    const x0 = -Math.floor(SIGNPOST_W / 2);
    // Outline, post, plaque at the top.
    g.fillStyle(Palette.playerOutline, 1).fillRect(
      x0 - 1,
      -SIGNPOST_H - 1,
      SIGNPOST_W + 2,
      SIGNPOST_H + 1,
    );
    g.fillStyle(post, 1).fillRect(x0, -SIGNPOST_H, SIGNPOST_W, SIGNPOST_H);
    g.fillStyle(Palette.playerOutline, 1).fillRect(x0 - 4, -SIGNPOST_H - 1, SIGNPOST_W + 8, 9);
    g.fillStyle(plaque, 1).fillRect(x0 - 3, -SIGNPOST_H, SIGNPOST_W + 6, 7);
    // The grounding shadow under it, by the prop rule's small case (3 high under 16 wide).
    const base = signpostBase(d.plot);
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
