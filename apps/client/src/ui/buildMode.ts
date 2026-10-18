import Phaser from 'phaser';
import { BUILD_TEXT, pieceDef } from '@iot/shared';
import type { PieceRowLines } from '../game/buildView.js';
import { displayable } from '../game/drawable.js';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import type { Rect as ViewRect } from '../game/view.js';
import { Palette } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { DEPTH } from '../render/depth.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';

/** The side list (UI px): on the right of the view, inset from its edge. */
const W = 156;
const INSET = 8;
const PAD = 6;
const INNER = W - 2 * PAD;
const ROW = 11;
/** The placeholder picture: a box with the footprint drawn as tiles inside it. */
const PICTURE = 26;
const PICTURE_TILE = 4;

export interface BuildModeHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  frame(): Readonly<ViewRect>;
  /** The pad or the keys moved the focus (the focus ring shows). */
  showFocus(): boolean;
  /** A piece's row pressed: it becomes the ghost. */
  pick(pieceId: string): void;
  /** MOVE on the selected standing piece: it becomes the ghost. */
  move(): void;
  /** TAKE DOWN on the selected standing piece. */
  takeDown(): void;
  /** The turn button beside the ghost (touch). */
  turn(): void;
}

/** What the focus is on: a row of the list, or one of the selected piece's buttons. */
type FocusItem = { row: number } | { button: 'move' | 'take-down' };

/**
 * Build mode's side list (docs/design/holding.md "Build mode", GAME
 * DESIGN's screen, M2 Task 6), a placeholder in the existing panel style
 * until ART's kit: the header ("Field, level 2", "Pieces 1/2"), a row per
 * piece this station can take (its placeholder picture, its name, its
 * materials against the store with short ones in the warning token, what it
 * needs, its effect line apart from the card, and LORE's card as its
 * tooltip), the selected standing piece's MOVE and TAKE DOWN, the one
 * refusal line in the footer, and the turn button beside the ghost for
 * touch. Mouse, keys, pad and touch; the scene feeds the key and pad events
 * in and sends the routes. Nothing here decides a placement: the server's
 * answer does.
 */
export class BuildMode {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly title: Text;
  private readonly count: Text;
  private readonly rows: {
    picture: Phaser.GameObjects.Graphics;
    initials: Text;
    name: Text;
    materials: Text[];
    needs: Text;
    effect: Text;
    zone: Phaser.GameObjects.Zone;
  }[] = [];
  private readonly selectedLine: Text;
  private readonly result: Text;
  private readonly tipG: Phaser.GameObjects.Graphics;
  private readonly tip: Text;
  private readonly moveButton: Button;
  private readonly takeDownButton: Button;
  private readonly turnButton: Button;
  private header = { title: '', count: '' };
  private lines: PieceRowLines[] = [];
  private selected: string | null = null;
  private focus: FocusItem = { row: 0 };
  private hoverRow: number | null = null;
  private resultAt = -1;
  private ghostUi: { x: number; y: number } | null = null;
  private placed = '';

  constructor(private readonly host: BuildModeHost) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.title = label(scene, 0, 0, '', Palette.uiInk);
    this.count = body(scene, 0, 0, '', Palette.uiInkMuted);
    this.selectedLine = body(scene, 0, 0, '', Palette.uiInkMuted).setVisible(false);
    this.result = body(scene, 0, 0, '', Palette.uiError, INNER).setVisible(false);
    this.tipG = scene.add.graphics().setVisible(false);
    this.tip = body(scene, 0, 0, '', Palette.uiInkMuted, INNER - 8).setVisible(false);
    this.moveButton = button(scene, 0, 0, BUILD_TEXT.MOVE, true, () => {
      host.move();
    });
    this.takeDownButton = button(scene, 0, 0, BUILD_TEXT.TAKE_DOWN, false, () => {
      host.takeDown();
    });
    this.turnButton = button(scene, 0, 0, BUILD_TEXT.TURN, false, () => {
      host.turn();
    });
    const objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [
      this.g,
      this.title,
      this.count,
      this.selectedLine,
      this.result,
      this.moveButton.container,
      this.takeDownButton.container,
      this.turnButton.container,
      this.tipG,
      this.tip,
    ];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
    this.tipG.setDepth(DEPTH.cursor - 1);
    this.tip.setDepth(DEPTH.cursor - 1);
    this.moveButton.container.setVisible(false);
    this.takeDownButton.container.setVisible(false);
    this.turnButton.container.setVisible(false);
  }

  /** The latest answer: the header, the rows and which standing piece is selected (null for none). */
  sync(header: { title: string; count: string }, lines: PieceRowLines[], selected: string | null): void {
    this.header = header;
    this.lines = lines;
    this.selected = selected;
    this.title.setText(header.title);
    this.count.setText(header.count);
    while (this.rows.length < lines.length) {
      const i = this.rows.length;
      const zone = this.host.scene.add.zone(0, 0, INNER, ROW).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.focus = { row: i };
        this.pressRow(i);
      });
      zone.on('pointerover', () => {
        this.hoverRow = i;
        this.placed = '';
      });
      zone.on('pointerout', () => {
        if (this.hoverRow === i) this.hoverRow = null;
        this.placed = '';
      });
      const row = {
        picture: this.host.scene.add.graphics(),
        initials: label(this.host.scene, 0, 0, '', Palette.uiInkOnGlow),
        name: label(this.host.scene, 0, 0, '', Palette.uiInk),
        materials: [body(this.host.scene, 0, 0, '', Palette.uiInkMuted), body(this.host.scene, 0, 0, '', Palette.uiInkMuted)],
        needs: body(this.host.scene, 0, 0, '', Palette.uiInkMuted),
        effect: body(this.host.scene, 0, 0, '', Palette.spark),
        zone,
      };
      this.rows.push(row);
      const objects = [row.picture, row.initials, row.name, ...row.materials, row.needs, row.effect, row.zone];
      this.host.layer.add(objects);
      for (const o of objects) o.setDepth(DEPTH.prompt);
    }
    lines.forEach((l, i) => {
      const row = this.rows[i];
      if (!row) return;
      row.initials.setText(l.initials);
      row.name.setText(l.name);
      l.materials.forEach((m, j) => {
        row.materials[j]?.setText(m.text).setTint(m.short ? Palette.uiWarning : Palette.uiInkMuted);
      });
      row.needs.setText(l.needs ?? '');
      row.effect.setText(l.effect);
    });
    const name = selected ? displayable(pieceDef(selected)?.name ?? selected) : '';
    this.selectedLine.setText(name);
    if ('button' in this.focus && !selected) this.focus = { row: 0 };
    this.placed = '';
  }

  /** A refusal's line from the server, with the inventory's blink-and-hold timing. */
  setResult(line: string): void {
    this.result.setText(line).setVisible(true);
    this.resultAt = this.host.scene.time.now;
    this.placed = '';
  }

  /** Where the ghost is on the UI grid this frame (its top-right corner), for the turn button; null without a ghost. */
  setGhostUi(at: { x: number; y: number } | null): void {
    const key = at ? `${Math.round(at.x)},${Math.round(at.y)}` : '';
    const old = this.ghostUi ? `${Math.round(this.ghostUi.x)},${Math.round(this.ghostUi.y)}` : '';
    if (key === old) return;
    this.ghostUi = at;
    this.placed = '';
  }

  // --- Keys and the pad -----------------------------------------------------

  private items(): FocusItem[] {
    const items: FocusItem[] = this.lines.map((_, i) => ({ row: i }));
    if (this.selected) items.push({ button: 'move' }, { button: 'take-down' });
    return items;
  }

  /** Up and down: the rows, then the selected piece's buttons. */
  moveFocus(delta: number): void {
    const items = this.items();
    if (items.length === 0) return;
    const at = items.findIndex((it) => JSON.stringify(it) === JSON.stringify(this.focus));
    const next = items[(((Math.max(0, at) + delta) % items.length) + items.length) % items.length];
    if (next) this.focus = next;
    this.placed = '';
  }

  /** The focus onto the selected piece's MOVE (a standing piece just selected). */
  focusButtons(): void {
    if (this.selected) this.focus = { button: 'move' };
    this.placed = '';
  }

  /** Enter or Cross: a row picks its piece (not a locked or standing one); a button presses. */
  press(): void {
    if ('row' in this.focus) this.pressRow(this.focus.row);
    else if (this.focus.button === 'move') this.host.move();
    else this.host.takeDown();
  }

  private pressRow(i: number): void {
    const l = this.lines[i];
    if (!l || l.locked || l.built) return;
    this.host.pick(l.pieceId);
  }

  /** Whether the focus is on a row (the pad's Up/Down move it; with a ghost they move the cursor instead). */
  get focusOnRow(): boolean {
    return 'row' in this.focus;
  }

  // --- Drawing ---------------------------------------------------------------

  /** The list's rectangle (UI px). */
  rect(): ViewRect {
    const frame = this.host.frame();
    return { x: frame.x + frame.w - INSET - W, y: frame.y + INSET, w: W, h: this.height() };
  }

  private rowHeight(l: PieceRowLines): number {
    const textRows = 10 + ROW * (l.materials.length + (l.needs ? 1 : 0) + 1);
    return Math.max(PICTURE, textRows) + 6;
  }

  private height(): number {
    const rows = this.lines.reduce((n, l) => n + this.rowHeight(l), 0);
    const buttons = this.selected ? ROW + 4 + 15 + 6 : 0;
    return PAD + 10 + ROW + 4 + 1 + 4 + rows + 4 + 1 + 4 + buttons + ROW + PAD;
  }

  private layout(): void {
    const r = this.rect();
    const focused = this.host.showFocus();
    const key = JSON.stringify([r, this.header, this.lines, this.selected, this.focus, focused, this.hoverRow, this.ghostUi, this.result.visible]);
    if (key === this.placed) return;
    this.placed = key;
    const g = this.g;
    g.clear();
    panel(g, r.x, r.y, r.w, r.h);
    const x = r.x + PAD;
    let ly = r.y + PAD;
    place(this.title, x, ly);
    ly += 10;
    place(this.count, x, ly);
    ly += ROW + 4;
    divider(g, x, ly, INNER);
    ly += 1 + 4;
    this.rows.forEach((row, i) => {
      const l = this.lines[i];
      const visible = l !== undefined;
      for (const o of [row.picture, row.initials, row.name, ...row.materials, row.needs, row.effect]) o.setVisible(visible);
      if (!l) {
        if (row.zone.input?.enabled) row.zone.disableInteractive();
        return;
      }
      const h = this.rowHeight(l);
      const isFocused = focused && 'row' in this.focus && this.focus.row === i;
      // The picture: a box with the footprint's tiles, the initials over it; muted while locked or standing.
      const pg = row.picture;
      pg.clear();
      pg.setPosition(x, ly);
      const boxFill = l.locked || l.built ? Palette.uiBevel : Palette.pieceFace;
      pg.fillStyle(isFocused ? Palette.uiFocus : Palette.uiOutline, 1).fillRect(-1, -1, PICTURE + 2, PICTURE + 2);
      pg.fillStyle(Palette.uiPanel, 1).fillRect(0, 0, PICTURE, PICTURE);
      const fw = l.footprint.cols * PICTURE_TILE;
      const fh = l.footprint.rows * PICTURE_TILE;
      const fx = Math.floor((PICTURE - fw) / 2);
      const fy = Math.floor((PICTURE - fh) / 2);
      for (let tr = 0; tr < l.footprint.rows; tr++)
        for (let tc = 0; tc < l.footprint.cols; tc++) {
          pg.fillStyle(Palette.pieceShade, 1).fillRect(fx + tc * PICTURE_TILE, fy + tr * PICTURE_TILE, PICTURE_TILE, PICTURE_TILE);
          pg.fillStyle(boxFill, 1).fillRect(fx + tc * PICTURE_TILE, fy + tr * PICTURE_TILE, PICTURE_TILE - 1, PICTURE_TILE - 1);
        }
      row.initials.setTint(l.locked || l.built ? Palette.uiInkMuted : Palette.uiInk);
      place(row.initials, x + PICTURE / 2, ly + PICTURE - 9, 0.5);
      // The text beside it.
      const tx = x + PICTURE + 5;
      let ty = ly;
      row.name.setTint(isFocused ? Palette.uiFocus : l.locked || l.built ? Palette.uiInkMuted : Palette.uiInk);
      place(row.name, tx, ty);
      ty += 10;
      l.materials.forEach((_, j) => {
        const t = row.materials[j];
        if (!t) return;
        place(t, tx, ty);
        ty += ROW;
      });
      for (let j = l.materials.length; j < row.materials.length; j++) row.materials[j]?.setVisible(false);
      row.needs.setVisible(l.needs !== null);
      if (l.needs !== null) {
        place(row.needs, tx, ty);
        ty += ROW;
      }
      place(row.effect, tx, ty);
      row.zone.setPosition(x, ly).setSize(INNER, h - 2);
      const area: unknown = row.zone.input?.hitArea;
      if (area instanceof Phaser.Geom.Rectangle) area.setSize(INNER, h - 2);
      if (!row.zone.input?.enabled) row.zone.setInteractive({ useHandCursor: true });
      ly += h;
    });
    ly += 4;
    divider(g, x, ly, INNER);
    ly += 1 + 4;
    const showButtons = this.selected !== null;
    this.selectedLine.setVisible(showButtons);
    this.moveButton.container.setVisible(showButtons);
    this.takeDownButton.container.setVisible(showButtons);
    if (showButtons) {
      place(this.selectedLine, x, ly);
      ly += ROW + 4;
      this.moveButton.container.setPosition(x, ly);
      this.moveButton.setFocused(focused && 'button' in this.focus && this.focus.button === 'move');
      this.takeDownButton.container.setPosition(x + this.moveButton.width + 6, ly);
      this.takeDownButton.setFocused(focused && 'button' in this.focus && this.focus.button === 'take-down');
      ly += 15 + 6;
    }
    place(this.result, x, ly);
    // The card (LORE) as the tooltip of the hovered row, or the focused one on the pad and the keys.
    const tipRow = this.hoverRow ?? (focused && 'row' in this.focus ? this.focus.row : null);
    const card = tipRow === null ? null : (this.lines[tipRow]?.card ?? null);
    this.tipG.clear();
    if (card !== null) {
      this.tip.setText(card);
      const tw = Math.min(INNER, Math.round(this.tip.width) + 8);
      const th = Math.round(this.tip.height) + 4;
      const tipX = r.x - tw - 4;
      const tipY = Math.min(r.y + r.h - th, Math.max(r.y, this.rows[tipRow ?? 0]?.zone.y ?? r.y));
      panel(this.tipG, tipX, tipY, tw, th, { plain: true });
      place(this.tip, tipX + 4, tipY + 2);
    }
    this.tipG.setVisible(card !== null);
    this.tip.setVisible(card !== null);
    // The turn button beside the ghost (touch): to its right, at its top.
    this.turnButton.container.setVisible(this.ghostUi !== null);
    if (this.ghostUi) this.turnButton.container.setPosition(Math.round(this.ghostUi.x + 3), Math.round(this.ghostUi.y));
  }

  /** Every frame: the layout and the result line's timing. */
  update(): void {
    this.layout();
    if (this.resultAt >= 0) {
      const elapsed = this.host.scene.time.now - this.resultAt;
      if (elapsed >= REFUSAL_LIFE_MS) {
        this.result.setVisible(false);
        this.resultAt = -1;
        this.placed = '';
      } else this.result.setVisible(refusalVisible(elapsed));
    }
  }

  /** What the playtests read. */
  snapshot(): {
    title: string;
    count: string;
    rows: { pieceId: string; name: string; materials: string[]; needs: string | null; effect: string; locked: boolean; built: boolean }[];
    selected: string | null;
    focus: FocusItem;
    result: string;
    tip: string | null;
    turn: boolean;
  } {
    return {
      title: this.header.title,
      count: this.header.count,
      rows: this.lines.map((l) => ({ pieceId: l.pieceId, name: l.name, materials: l.materials.map((m) => m.text), needs: l.needs, effect: l.effect, locked: l.locked, built: l.built })),
      selected: this.selected,
      focus: this.focus,
      result: this.result.visible ? this.result.text : '',
      tip: this.tip.visible ? this.tip.text : null,
      turn: this.turnButton.container.visible,
    };
  }

  destroy(): void {
    for (const o of [this.g, this.title, this.count, this.selectedLine, this.result, this.tipG, this.tip]) o.destroy();
    for (const row of this.rows) for (const o of [row.picture, row.initials, row.name, ...row.materials, row.needs, row.effect, row.zone]) o.destroy();
    this.moveButton.container.destroy(true);
    this.takeDownButton.container.destroy(true);
    this.turnButton.container.destroy(true);
  }
}
