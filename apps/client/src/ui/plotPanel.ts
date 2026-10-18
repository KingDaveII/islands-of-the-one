import type Phaser from 'phaser';
import { PLOT_TEXT, shapeLetters, sigilPath, type PlotView, type WordSlot } from '@iot/shared';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import {
  groundElement,
  noWordsLine,
  plotPanelLines,
  slotChoices,
  type Picked,
  type PlotChoice,
  type PlotPanelLines,
} from '../game/plotView.js';
import type { Rect as ViewRect } from '../game/view.js';
import { Palette } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { DEPTH } from '../render/depth.js';
import { plotLetters, type LetterSheet } from '../render/letters.js';
import { pixelLine, ring as pixelRing } from '../render/pixels.js';
import { ELEMENT_COLORS } from '../render/plots.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';

/** The panel (UI px). */
const W = 244;
const PAD = 8;
const INNER = W - 2 * PAD;
const ROW = 11;
/** The two slots on the ring: each this wide and tall, the letters at 2 UI px per sheet px inside. */
const SLOT_W = 64;
const SLOT_H = 26;
const SCALE = 2;
/** The sigil preview's grid: its cell in UI px. */
const SIGIL_CELL = 10;
const SIGIL_W = 3 * SIGIL_CELL;

export interface PlotPanelHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  frame(): Readonly<ViewRect>;
  sheet(): LetterSheet | null;
  /** The pad or the keys moved the focus (the focus ring shows). */
  showFocus(): boolean;
  /** CONFIRM: send the sentence; the server's answer decides. */
  confirm(picked: Picked): void;
}

/** What the focus is on: the slot row (the selected slot), a choice of the selected slot, or CONFIRM. */
type FocusItem = { slot: true } | { choice: number } | { confirm: true };

/**
 * The plot sentence panel (docs/design/holding.md "Plots", GAME DESIGN's
 * screen, M2 Task 5): the title, the ring with two slots right to left
 * (Ground on the right, Virtue on the left), the known tiles that fit the
 * selected slot (each with its letters, how it is said, its meaning and its
 * effect; None leaves the Virtue empty), the preview (what the Ground builds,
 * the Virtue's effect, the sigil drawn live), the cost line (with its tooltip
 * on a rename), the level and the pieces, CONFIRM (greyed while the sentence
 * is unchanged or has no Ground) and the one refusal line. Mouse, keys, pad
 * and touch; the scene feeds the key and pad events in. Nothing here decides
 * the name: the server's answer does.
 */
export class PlotPanel {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly title: Text;
  private readonly slotLabels: { ground: Text; virtue: Text };
  private readonly slotZones: { ground: Phaser.GameObjects.Zone; virtue: Phaser.GameObjects.Zone };
  private readonly rows: {
    letters: Phaser.GameObjects.Graphics;
    name: Text;
    effect: Text;
    marker: Text;
    zone: Phaser.GameObjects.Zone;
  }[] = [];
  private readonly empty: Text;
  private readonly builds: Text;
  private readonly effect: Text;
  private readonly cost: Text;
  private readonly costZone: Phaser.GameObjects.Zone;
  private readonly level: Text;
  private readonly pieces: Text;
  private readonly result: Text;
  private readonly tipG: Phaser.GameObjects.Graphics;
  private readonly tip: Text;
  private readonly previewZone: Phaser.GameObjects.Zone;
  private readonly confirmButton: Button;
  private plot: PlotView | null = null;
  private known: readonly string[] = [];
  private picked: Picked = { ground: null, virtue: null };
  private slot: WordSlot = 'ground';
  private choices: PlotChoice[] = [];
  private focus: FocusItem = { slot: true };
  private lines: PlotPanelLines | null = null;
  private resultAt = -1;
  private tipOver: 'cost' | 'preview' | null = null;
  private placed = '';
  private sigilBox = { x: 0, y: 0 };
  private slotBoxes = { ground: { x: 0, y: 0 }, virtue: { x: 0, y: 0 } };
  private sheetDrawn: LetterSheet | null = null;

  constructor(private readonly host: PlotPanelHost) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.face = scene.add.graphics();
    this.title = label(scene, 0, 0, '', Palette.uiInk);
    this.slotLabels = {
      ground: body(scene, 0, 0, PLOT_TEXT.SLOT_GROUND, Palette.uiInkMuted),
      virtue: body(scene, 0, 0, PLOT_TEXT.SLOT_VIRTUE, Palette.uiInkMuted),
    };
    const slotZone = (slot: WordSlot): Phaser.GameObjects.Zone => {
      const z = scene.add
        .zone(0, 0, SLOT_W, SLOT_H + ROW)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        this.selectSlot(slot);
        this.focus = { slot: true };
        this.placed = '';
      });
      return z;
    };
    this.slotZones = { ground: slotZone('ground'), virtue: slotZone('virtue') };
    this.empty = body(scene, 0, 0, '', Palette.uiInkMuted);
    this.builds = body(scene, 0, 0, '', Palette.spark);
    this.effect = body(scene, 0, 0, '', Palette.spark);
    this.cost = body(scene, 0, 0, '', Palette.uiInk);
    this.costZone = scene.add.zone(0, 0, INNER, ROW).setOrigin(0, 0).setInteractive();
    this.costZone.on('pointerover', () => {
      if (this.lines?.costTip) this.tipOver = 'cost';
    });
    this.costZone.on('pointerout', () => {
      if (this.tipOver === 'cost') this.tipOver = null;
    });
    this.previewZone = scene.add.zone(0, 0, SIGIL_W, SIGIL_W).setOrigin(0, 0).setInteractive();
    this.previewZone.on('pointerover', () => {
      if (this.lines?.previewTip) this.tipOver = 'preview';
    });
    this.previewZone.on('pointerout', () => {
      if (this.tipOver === 'preview') this.tipOver = null;
    });
    this.level = body(scene, 0, 0, '', Palette.uiInkMuted);
    this.pieces = body(scene, 0, 0, '', Palette.uiInkMuted);
    this.result = body(scene, 0, 0, '', Palette.uiError).setVisible(false);
    this.tipG = scene.add.graphics().setVisible(false);
    this.tip = body(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    this.confirmButton = button(scene, 0, 0, PLOT_TEXT.CONFIRM, true, () => {
      this.pressConfirm();
    });
    const objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [
      this.g,
      this.face,
      this.title,
      this.slotLabels.ground,
      this.slotLabels.virtue,
      this.slotZones.ground,
      this.slotZones.virtue,
      this.empty,
      this.builds,
      this.effect,
      this.cost,
      this.costZone,
      this.previewZone,
      this.level,
      this.pieces,
      this.result,
      this.confirmButton.container,
      this.tipG,
      this.tip,
    ];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
    this.tipG.setDepth(DEPTH.cursor - 1);
    this.tip.setDepth(DEPTH.cursor - 1);
  }

  /** Opens on a plot with the words the Kindled knows: the picked sentence starts as the plot's own. */
  open(plot: PlotView, known: readonly string[]): void {
    this.plot = plot;
    this.known = known;
    this.picked = { ground: plot.ground, virtue: plot.virtue };
    this.slot = 'ground';
    this.focus = { slot: true };
    this.rebuild();
  }

  /** The latest answer's plot and words (a rename's cost may have changed): the picked sentence stays. */
  sync(plot: PlotView, known: readonly string[]): void {
    this.plot = plot;
    this.known = known;
    this.rebuild();
  }

  /** A refusal's line from the server, with the inventory's blink-and-hold timing. */
  setResult(line: string): void {
    this.result.setText(line).setVisible(true);
    this.resultAt = this.host.scene.time.now;
  }

  get pickedSentence(): Picked {
    return { ...this.picked };
  }

  private selectSlot(slot: WordSlot): void {
    if (this.slot === slot) return;
    this.slot = slot;
    this.rebuild();
  }

  private pick(i: number): void {
    const c = this.choices[i];
    if (!c) return;
    if (this.slot === 'ground') this.picked = { ...this.picked, ground: c.wordId };
    else this.picked = { ...this.picked, virtue: c.wordId };
    this.rebuild();
  }

  private rebuild(): void {
    const plot = this.plot;
    if (!plot) return;
    this.choices = slotChoices(this.slot, this.known);
    this.lines = plotPanelLines(plot, this.picked);
    const l = this.lines;
    this.title.setText(l.title);
    this.builds.setText(l.builds ?? '').setVisible(l.builds !== null);
    this.effect.setText(l.effect ?? '').setVisible(l.effect !== null);
    this.cost.setText(l.cost);
    this.level.setText(l.level);
    this.pieces.setText(l.pieces);
    this.empty
      .setText(this.choices.length === 0 ? noWordsLine(this.slot) : '')
      .setVisible(this.choices.length === 0);
    while (this.rows.length < this.choices.length) {
      const i = this.rows.length;
      const zone = this.host.scene.add
        .zone(0, 0, INNER, ROW + 8)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.focus = { choice: i };
        this.pick(i);
      });
      const row = {
        letters: this.host.scene.add.graphics(),
        name: body(this.host.scene, 0, 0, '', Palette.uiInk),
        effect: body(this.host.scene, 0, 0, '', Palette.uiInkMuted),
        marker: label(this.host.scene, 0, 0, '>', Palette.uiFocus).setVisible(false),
        zone,
      };
      this.rows.push(row);
      const objects = [row.letters, row.name, row.effect, row.marker, row.zone];
      this.host.layer.add(objects);
      for (const o of objects) o.setDepth(DEPTH.prompt);
    }
    this.choices.forEach((c, i) => {
      const row = this.rows[i];
      if (!row) return;
      row.name.setText(c.label);
      row.effect.setText(c.effect ?? '');
    });
    this.confirmButton.setEnabled(l.confirmEnabled);
    this.placed = '';
  }

  /** The word picked for the selected slot, as a choice index (None for an empty Virtue). */
  private pickedIndex(): number {
    const id = this.slot === 'ground' ? this.picked.ground : this.picked.virtue;
    return this.choices.findIndex((c) => c.wordId === id);
  }

  // --- Keys and the pad -----------------------------------------------------

  /** Up and down: the slot row, then the choices, then CONFIRM. */
  moveFocus(delta: number): void {
    const items: FocusItem[] = [
      { slot: true },
      ...this.choices.map((_, i) => ({ choice: i })),
      { confirm: true },
    ];
    const at =
      'slot' in this.focus ? 0 : 'choice' in this.focus ? 1 + this.focus.choice : items.length - 1;
    const next = items[(((at + delta) % items.length) + items.length) % items.length] ?? {
      slot: true,
    };
    this.focus = next;
    this.placed = '';
  }

  /** Left and right: the other slot (the Ground is on the right, the Virtue on the left). */
  moveSide(delta: number): void {
    this.selectSlot(delta < 0 ? 'virtue' : 'ground');
    if (!('slot' in this.focus)) this.focus = { slot: true };
    this.placed = '';
  }

  /** Enter or Cross: on the slot row, the first choice; on a choice, pick it; on CONFIRM, press it. */
  press(): void {
    if ('slot' in this.focus) {
      if (this.choices.length > 0) this.focus = { choice: Math.max(0, this.pickedIndex()) };
      this.placed = '';
      return;
    }
    if ('choice' in this.focus) {
      this.pick(this.focus.choice);
      return;
    }
    this.pressConfirm();
  }

  private pressConfirm(): void {
    if (!this.lines?.confirmEnabled) return;
    this.host.confirm(this.pickedSentence);
  }

  // --- Drawing ---------------------------------------------------------------

  private layout(): void {
    const frame = this.host.frame();
    const l = this.lines;
    if (!l) return;
    const rows = this.choices.length || 1;
    const previewRows = (l.builds ? 1 : 0) + (l.effect ? 1 : 0);
    const h =
      PAD +
      10 +
      4 +
      SLOT_H +
      ROW +
      6 +
      1 +
      4 +
      rows * (ROW + 8) +
      4 +
      1 +
      4 +
      Math.max(SIGIL_W, previewRows * ROW) +
      4 +
      3 * ROW +
      4 +
      15 +
      4 +
      ROW +
      PAD;
    const w = W;
    const x = Math.round(frame.x + frame.w / 2 - w / 2);
    const y = Math.round(frame.y + frame.h / 2 - h / 2);
    const key = `${x},${y},${h},${this.slot},${JSON.stringify(this.focus)},${this.host.showFocus()},${JSON.stringify(this.picked)},${this.choices.length},${this.tipOver ?? ''}`;
    if (key === this.placed) return;
    this.placed = key;
    const g = this.g;
    g.clear();
    panel(g, x, y, w, h);
    let ly = y + PAD;
    place(this.title, x + PAD, ly);
    ly += 10 + 4;
    // The ring with two slots, right to left: the Ground on the right, the Virtue on the left.
    const cx = x + w / 2;
    this.slotBoxes = {
      ground: { x: Math.round(cx + 6), y: ly },
      virtue: { x: Math.round(cx - 6 - SLOT_W), y: ly },
    };
    for (const slot of ['ground', 'virtue'] as const) {
      const b = this.slotBoxes[slot];
      const selected = this.slot === slot;
      const focused = selected && 'slot' in this.focus && this.host.showFocus();
      g.fillStyle(
        focused ? Palette.uiFocus : selected ? Palette.spark : Palette.uiBevel,
        1,
      ).fillRect(b.x - 1, b.y - 1, SLOT_W + 2, SLOT_H + 2);
      g.fillStyle(Palette.uiPanel, 1).fillRect(b.x, b.y, SLOT_W, SLOT_H);
      place(this.slotLabels[slot], b.x + SLOT_W / 2, b.y + SLOT_H + 1, 0.5);
      this.slotZones[slot].setPosition(b.x, b.y);
    }
    // The divider between the slots, the ring's join.
    g.fillStyle(Palette.uiInk, 1).fillRect(Math.round(cx) - 1, ly + SLOT_H / 2 - 1, 2, 2);
    ly += SLOT_H + ROW + 6;
    divider(g, x + PAD, ly, INNER);
    ly += 1 + 4;
    // The choices for the selected slot.
    this.empty.setVisible(this.choices.length === 0);
    if (this.choices.length === 0) place(this.empty, x + PAD, ly + 4);
    const pickedAt = this.pickedIndex();
    this.rows.forEach((row, i) => {
      const visible = i < this.choices.length;
      row.name.setVisible(visible);
      row.effect.setVisible(visible);
      row.marker.setVisible(visible && i === pickedAt);
      row.letters.setVisible(visible);
      row.zone.setPosition(x + PAD, ly);
      if (!visible) return;
      const focused = this.host.showFocus() && 'choice' in this.focus && this.focus.choice === i;
      row.name.setTint(focused ? Palette.uiFocus : i === pickedAt ? Palette.spark : Palette.uiInk);
      place(row.marker, x + PAD, ly + 4);
      place(row.name, x + PAD + 8, ly + 4);
      // The tile's letters after its name; its effect right-aligned, only while the row has room for it
      // (the preview under the rows shows the picked tile's effect in full).
      const lettersX = x + PAD + 8 + Math.round(row.name.width) + 6;
      const letters = this.choices[i]?.letters ?? '';
      const lettersW = letters === '' ? 0 : shapeLetters(letters).width;
      row.letters.setPosition(lettersX, ly + 1);
      place(row.effect, x + w - PAD, ly + 4, 1);
      row.effect.setVisible(lettersX + lettersW + 6 + Math.round(row.effect.width) <= x + w - PAD);
      ly += ROW + 8;
    });
    ly += 4;
    divider(g, x + PAD, ly, INNER);
    ly += 1 + 4;
    // The preview: the sigil at the left, what the sentence builds and does beside it.
    this.sigilBox = { x: x + PAD, y: ly };
    this.previewZone.setPosition(x + PAD, ly);
    let py = ly;
    if (l.builds) {
      place(this.builds, x + PAD + SIGIL_W + 8, py);
      py += ROW;
    }
    if (l.effect) place(this.effect, x + PAD + SIGIL_W + 8, py);
    ly += Math.max(SIGIL_W, previewRows * ROW) + 4;
    place(this.cost, x + PAD, ly);
    this.costZone.setPosition(x + PAD, ly);
    ly += ROW;
    place(this.level, x + PAD, ly);
    ly += ROW;
    place(this.pieces, x + PAD, ly);
    ly += ROW + 4;
    this.confirmButton.container.setPosition(x + PAD, ly);
    this.confirmButton.setFocused(this.host.showFocus() && 'confirm' in this.focus);
    ly += 15 + 4;
    place(this.result, x + w - PAD, ly, 1);
    // The tooltips: the cost's over its line, the preview's over the sigil.
    const tipText =
      this.tipOver === 'cost' ? l.costTip : this.tipOver === 'preview' ? l.previewTip : null;
    this.tipG.clear();
    if (tipText) {
      this.tip.setText(tipText).setMaxWidth(INNER - 8);
      const tw = Math.min(INNER, Math.round(this.tip.width) + 8);
      const ty =
        this.tipOver === 'cost'
          ? this.costZone.y - this.tip.height - 6
          : this.sigilBox.y - this.tip.height - 6;
      panel(this.tipG, x + PAD, ty, tw, Math.round(this.tip.height) + 4, { plain: true });
      place(this.tip, x + PAD + 4, ty + 2);
    }
    this.tipG.setVisible(tipText !== null);
    this.tip.setVisible(tipText !== null);
    this.drawFace();
  }

  /** The slots' letters, each choice's tile and the sigil, from the letter sheet. */
  private drawFace(): void {
    const g = this.face;
    g.clear();
    const sheet = this.host.sheet();
    this.sheetDrawn = sheet;
    const color = ELEMENT_COLORS[groundElement(this.picked.ground)];
    const letterOf = (slot: WordSlot): string => {
      const id = slot === 'ground' ? this.picked.ground : this.picked.virtue;
      return (
        this.choices.find((c) => c.wordId === id && c.wordId !== null)?.letters ??
        (id ? (slotChoices(slot, this.known).find((c) => c.wordId === id)?.letters ?? '') : '')
      );
    };
    if (sheet) {
      for (const slot of ['ground', 'virtue'] as const) {
        const letters = letterOf(slot);
        if (letters === '') continue;
        const b = this.slotBoxes[slot];
        const width = shapeLetters(letters).width * SCALE;
        plotLetters(g, sheet, letters, Math.round(b.x + SLOT_W / 2 - width / 2), b.y + 5, {
          scale: SCALE,
        });
      }
      this.rows.forEach((row, i) => {
        const c = this.choices[i];
        row.letters.clear();
        if (!c || c.letters === '') return;
        // A tile's letters at 1 UI px per sheet px, after its name.
        plotLetters(row.letters, sheet, c.letters, 0, 0, { scale: 1 });
      });
    }
    // The sigil, drawn live: the faint grid, the line through the chambers, the circle and the bar.
    const o = this.sigilBox;
    for (let i = 0; i <= 3; i++) {
      pixelLine(
        g,
        o.x,
        o.y + i * SIGIL_CELL,
        o.x + SIGIL_W,
        o.y + i * SIGIL_CELL,
        Palette.plotGrid,
        2,
      );
      pixelLine(
        g,
        o.x + i * SIGIL_CELL,
        o.y,
        o.x + i * SIGIL_CELL,
        o.y + SIGIL_W,
        Palette.plotGrid,
        2,
      );
    }
    const path = sigilPath(this.lines?.letters ?? '');
    const points = path.steps.map((s) => ({
      x: o.x + s.col * SIGIL_CELL + SIGIL_CELL / 2,
      y: o.y + s.row * SIGIL_CELL + SIGIL_CELL / 2,
    }));
    const first = points[0];
    if (!first) return;
    pixelRing(g, first.x, first.y, 2, color);
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a && b && (a.x !== b.x || a.y !== b.y)) pixelLine(g, a.x, a.y, b.x, b.y, color, 1, 1);
    }
    for (const mark of path.marks) {
      const p = points[mark.step];
      if (!p) continue;
      if (mark.kind === 'loop') pixelRing(g, p.x, p.y, 2, color);
      else if (mark.kind === 'hook') g.fillStyle(color, 1).fillRect(p.x + 1, p.y - 3, 1, 3);
    }
    const last = points[points.length - 1];
    if (last) g.fillStyle(color, 1).fillRect(last.x - 2, last.y - 1, 5, 1);
  }

  /** Every frame: the layout, the sheet once it loads, the result line's timing. */
  update(): void {
    if (this.host.sheet() !== this.sheetDrawn) this.placed = '';
    this.layout();
    if (this.resultAt >= 0) {
      const elapsed = this.host.scene.time.now - this.resultAt;
      if (elapsed >= REFUSAL_LIFE_MS) {
        this.result.setVisible(false);
        this.resultAt = -1;
      } else this.result.setVisible(refusalVisible(elapsed));
    }
  }

  /** What the playtests read. */
  snapshot(): {
    plotId: string;
    title: string;
    slot: WordSlot;
    picked: Picked;
    choices: string[];
    empty: string | null;
    builds: string | null;
    effect: string | null;
    cost: string;
    level: string;
    confirmOn: boolean;
    result: string;
    tip: string | null;
    sigilSteps: number;
  } {
    const l = this.lines;
    return {
      plotId: this.plot?.id ?? '',
      title: l?.title ?? '',
      slot: this.slot,
      picked: this.pickedSentence,
      choices: this.choices.map((c) => c.label),
      empty: this.choices.length === 0 ? noWordsLine(this.slot) : null,
      builds: l?.builds ?? null,
      effect: l?.effect ?? null,
      cost: l?.cost ?? '',
      level: l?.level ?? '',
      confirmOn: l?.confirmEnabled ?? false,
      result: this.result.visible ? this.result.text : '',
      tip: this.tip.visible ? this.tip.text : null,
      sigilSteps: sigilPath(l?.letters ?? '').steps.length,
    };
  }

  destroy(): void {
    for (const o of [
      this.g,
      this.face,
      this.title,
      this.slotLabels.ground,
      this.slotLabels.virtue,
      this.slotZones.ground,
      this.slotZones.virtue,
      this.empty,
      this.builds,
      this.effect,
      this.cost,
      this.costZone,
      this.previewZone,
      this.level,
      this.pieces,
      this.result,
      this.tipG,
      this.tip,
    ])
      o.destroy();
    for (const row of this.rows)
      for (const o of [row.letters, row.name, row.effect, row.marker, row.zone]) o.destroy();
    this.confirmButton.container.destroy(true);
  }
}
