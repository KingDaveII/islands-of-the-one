import type Phaser from 'phaser';
import { RACK_TEXT, type RackView } from '@iot/shared';
import type { Rect as ViewRect } from '../game/view.js';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import { moveRackFocus, rackPressable, rackRows, type RackRow } from '../game/rackView.js';
import { Palette } from '../palette.js';
import { button, BUTTON_H, type Button } from '../render/button.js';
import { DEPTH } from '../render/depth.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';

/** The panel (UI px): wide enough for a card's lines and the state on the right of a name. */
const W = 300;
const PAD = 8;
const INNER = W - 2 * PAD;
const ROW = 11;
/** The card's column stops short of the right edge, where the state stands on the name's row. */
const CARD_W = INNER - 60;

export interface RackPanelHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  frame(): Readonly<ViewRect>;
  /** The pad or the keys moved the focus (the focus ring shows). */
  showFocus(): boolean;
  /** TAKE: the weapon a run takes from now on (POST /api/holding/rack/choose). */
  choose(weaponId: string): void;
}

/** One drawn row: the weapon's texts, its state on the right (text, or the TAKE button) and the zone the pointer picks it by. */
interface Row {
  name: Text;
  card: Text;
  kit: Text;
  state: Text;
  take: Button | null;
  zone: Phaser.GameObjects.Zone;
  row: RackRow;
}

/**
 * The weapon rack's panel (docs/design/holding.md "The weapon rack", M2
 * Task 8; GAME DESIGN's row with LORE's words): Use on the rack opens it. The
 * title, LORE's tooltip line muted under it, then one row per weapon owned in
 * roster order: the name, the card muted and wrapped, the kit in input order
 * joined by " · ", and on the right its state: "Taken" (highlighted) on the
 * weapon going out next run, the TAKE button on an owned weapon that can
 * fight, and LORE's "Your hands aren't ready for this one yet." greyed on one
 * the sim can't run (never shown in M2). A refusal is one line in the footer
 * with the inventory's blink-and-hold timing. Up and Down move the focus
 * through the rows, Cross or Enter chooses the focused row's weapon, Circle
 * or Esc closes (the scene's); the mouse clicks a row or its button, touch
 * taps them. The rows redraw from the server's answer, never ahead of it.
 */
export class RackPanel {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Text;
  private readonly tooltip: Text;
  private readonly result: Text;
  private rows: Row[] = [];
  private focus = 0;
  private resultAt = -1;
  private placed = '';

  constructor(private readonly host: RackPanelHost) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.title = label(scene, 0, 0, RACK_TEXT.TITLE, Palette.uiInk);
    this.tooltip = body(scene, 0, 0, RACK_TEXT.TOOLTIP, Palette.uiInkMuted, INNER);
    this.result = body(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    const objects = [this.g, this.title, this.tooltip, this.result];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
  }

  /** The latest answer's rack: the rows are rebuilt from it. */
  sync(rack: RackView): void {
    for (const r of this.rows) this.destroyRow(r);
    const { scene, layer } = this.host;
    this.rows = rackRows(rack).map((row, i) => {
      const zone = scene.add.zone(0, 0, INNER, ROW).setOrigin(0, 0).setInteractive({ useHandCursor: rackPressable(row) });
      zone.on('pointerdown', () => {
        this.focus = i;
        this.placed = '';
      });
      const take = rackPressable(row)
        ? button(scene, 0, 0, RACK_TEXT.TAKE, true, () => {
            this.host.choose(row.itemId);
          })
        : null;
      const drawn: Row = {
        name: body(scene, 0, 0, row.name, row.state === 'not-ready' ? Palette.uiInkMuted : Palette.uiInk),
        card: body(scene, 0, 0, row.card, Palette.uiInkMuted, CARD_W),
        kit: body(scene, 0, 0, row.kit, row.state === 'not-ready' ? Palette.uiInkMuted : Palette.uiInk),
        state: body(scene, 0, 0, row.stateText ?? '', row.state === 'taken' ? Palette.spark : Palette.uiInkMuted),
        take,
        zone,
        row,
      };
      const objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [drawn.name, drawn.card, drawn.kit, drawn.state, drawn.zone];
      if (take) objects.push(take.container);
      layer.add(objects);
      for (const o of objects) o.setDepth(DEPTH.prompt);
      return drawn;
    });
    this.focus = moveRackFocus(this.rows.length, Math.min(this.focus, Math.max(0, this.rows.length - 1)), 0);
    this.placed = '';
  }

  private destroyRow(r: Row): void {
    for (const o of [r.name, r.card, r.kit, r.state, r.zone]) o.destroy();
    r.take?.container.destroy(true);
  }

  /** A refusal's line from the server, in the footer, with the inventory's blink-and-hold timing. */
  setResult(line: string): void {
    this.result.setText(line).setVisible(true);
    this.resultAt = this.host.scene.time.now;
    this.placed = '';
  }

  // --- Keys and the pad -----------------------------------------------------

  /** Up and down through the rows. */
  moveFocus(delta: number): void {
    this.focus = moveRackFocus(this.rows.length, this.focus, delta);
    this.placed = '';
  }

  /** Enter or Cross: the focused row's TAKE; a Taken or not-ready row does nothing. */
  press(): void {
    const r = this.rows[this.focus];
    if (r && rackPressable(r.row)) this.host.choose(r.row.itemId);
  }

  // --- Drawing ---------------------------------------------------------------

  /** The panel's rectangle as last laid out (UI px, its drop shadow included): a tap outside it closes it (M2 Task 10). */
  private box: ViewRect = { x: 0, y: 0, w: 0, h: 0 };
  rect(): ViewRect {
    return { ...this.box };
  }

  private layout(): void {
    const frame = this.host.frame();
    const tipH = Math.round(this.tooltip.height);
    const rowH = (r: Row): number => ROW + Math.round(r.card.height) + 2 + (r.kit.text === '' ? 0 : ROW) + (r.row.state === 'not-ready' ? ROW : 0) + 4;
    const rowsH = this.rows.reduce((h, r) => h + rowH(r), 0);
    const h = PAD + 10 + 3 + tipH + 4 + 1 + 6 + rowsH + 2 + 1 + 4 + ROW + PAD;
    const x = Math.round(frame.x + frame.w / 2 - W / 2);
    const y = Math.round(frame.y + frame.h / 2 - h / 2);
    this.box = { x, y, w: W, h: h + 1 };
    const key = `${x},${y},${h},${this.focus},${this.host.showFocus()},${this.rows.map((r) => r.row.state).join()}`;
    if (key === this.placed) return;
    this.placed = key;
    this.g.clear();
    panel(this.g, x, y, W, h);
    let ly = y + PAD;
    place(this.title, x + PAD, ly);
    ly += 10 + 3;
    place(this.tooltip, x + PAD, ly);
    ly += tipH + 4;
    divider(this.g, x + PAD, ly, INNER);
    ly += 1 + 6;
    this.rows.forEach((r, i) => {
      const focused = this.host.showFocus() && i === this.focus;
      r.zone.setPosition(x + PAD, ly);
      r.name.setTint(focused ? Palette.uiFocus : r.row.state === 'not-ready' ? Palette.uiInkMuted : Palette.uiInk);
      place(r.name, x + PAD, ly);
      // The state on the right of the name's row: Taken, or the TAKE button; the not-ready line gets its own row below.
      if (r.take) {
        r.take.container.setPosition(x + W - PAD - r.take.width, ly - Math.round((BUTTON_H - ROW) / 2));
        r.take.setFocused(focused);
      }
      r.state.setVisible(r.row.state === 'taken' || r.row.state === 'not-ready');
      if (r.row.state === 'taken') place(r.state, x + W - PAD, ly, 1);
      ly += ROW;
      place(r.card, x + PAD, ly);
      ly += Math.round(r.card.height) + 2;
      if (r.kit.text !== '') {
        place(r.kit, x + PAD, ly);
        ly += ROW;
      }
      if (r.row.state === 'not-ready') {
        place(r.state, x + W - PAD, ly, 1);
        ly += ROW;
      }
      ly += 4;
    });
    ly += 2;
    divider(this.g, x + PAD, ly, INNER);
    ly += 1 + 4;
    place(this.result, x + W - PAD, ly, 1);
  }

  /** Every frame: the layout and the result line's timing. */
  update(): void {
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
    title: string;
    tooltip: string;
    rows: { itemId: string; name: string; card: string; kit: string; state: RackRow['state']; stateText: string | null; button: string | null }[];
    focus: number;
    result: string;
  } {
    return {
      title: this.title.text,
      tooltip: this.tooltip.text,
      rows: this.rows.map((r) => ({
        itemId: r.row.itemId,
        name: r.row.name,
        card: r.row.card,
        kit: r.kit.text,
        state: r.row.state,
        stateText: r.row.stateText,
        button: r.take ? RACK_TEXT.TAKE : null,
      })),
      focus: this.focus,
      result: this.result.visible ? this.result.text : '',
    };
  }

  destroy(): void {
    for (const o of [this.g, this.title, this.tooltip, this.result]) o.destroy();
    for (const r of this.rows) this.destroyRow(r);
    this.rows = [];
  }
}
