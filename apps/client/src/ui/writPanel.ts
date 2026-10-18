import type Phaser from 'phaser';
import { shapeLetters, type InventoryResponse, type WritView } from '@iot/shared';
import type { Rect as ViewRect } from '../game/view.js';
import {
  chargeLines,
  COUNT_SIGN,
  derive,
  EMET,
  faceStates,
  feedButtonLabel,
  feedChoices,
  feedLine,
  FILL,
  fillEnabled,
  flickerBeat,
  fullTip,
  heldLine,
  lineLine,
  NEXT_LINE_LINE,
  previewFeed,
  relightDone,
  relightProgress,
  rimLine,
  stateLine,
  takesCount,
  type FeedChoice,
} from '../game/writView.js';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import { Palette } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { DEPTH } from '../render/depth.js';
import { plotLetters, type LetterSheet } from '../render/letters.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';

/** The panel (UI px). */
const W = 244;
const PAD = 8;
const INNER = W - 2 * PAD;
/** The face's letters at 2 UI px per sheet px. */
const SCALE = 2;
const FACE_PAD = 6;
const FACE_H = FACE_PAD * 2 + 8 * SCALE * 2 + 4;
const ROW = 11;
/** A gin count goes up to this many at once. */
const MAX_COUNT = 99;

export interface WritPanelHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  frame(): Readonly<ViewRect>;
  sheet(): LetterSheet | null;
  /** The pad or the keys moved the focus (the focus ring shows). */
  showFocus(): boolean;
  feed(itemId: string, count: number): void;
  fill(): void;
}

/** What the focus is on: a kind's row, or a button. */
type FocusItem = { kind: number } | { button: 'feed' | 'fill' };

/**
 * The Writ panel (docs/design/holding.md "The Writ", GAME DESIGN's screen):
 * the face (אמת and the Name from the letter sheet, each letter in its state:
 * lit; flickering, ember with the outer letters switching between ember and
 * dim on the beat; dark and fading, the aleph dark so it reads מת and the
 * Name dim, then dark once line 1 has faded), the rim, the charge in words
 * (the exact time in a tooltip), the state line, line 1 and the greyed line
 * 2, the Sparkglass by kind with what the Kindled holds, each kind greyed
 * with GAME DESIGN's line when it doesn't fit now, the feed preview, FEED
 * ONE (FEED with a count for gin) and FILL (wild slivers). The face redraws
 * from the server's answer, never ahead of it; a relight from dark brings
 * the aleph back first, then each line, whole frames. Mouse, keys, pad and
 * touch; the scene feeds the key and pad events in.
 */
export class WritPanel {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly rim: Text;
  private readonly charge: Text;
  private readonly state: Text;
  private readonly line1: Text;
  private readonly line2: Text;
  private readonly rows: { name: Text; held: Text; refusal: Text; marker: Text; zone: Phaser.GameObjects.Zone }[] = [];
  private readonly preview: Text;
  private readonly result: Text;
  private readonly countText: Text;
  private readonly tipG: Phaser.GameObjects.Graphics;
  private readonly tip: Text;
  private readonly chargeZone: Phaser.GameObjects.Zone;
  /** The greyed buttons' tooltip while the Writ is full ("A sliver fits in about 4 h"). */
  private readonly buttonTipG: Phaser.GameObjects.Graphics;
  private readonly buttonTip: Text;
  private full = false;
  private feedButton: Button;
  private fillButton: Button;
  /** The gin count's steppers (mouse and touch; the keys and the pad use Left/Right). */
  private readonly less: Button;
  private readonly more: Button;
  private feedLabel = '';
  private view: WritView | null = null;
  private inventory: InventoryResponse | null = null;
  private choices: FeedChoice[] = [];
  private selected = 0;
  private focus: FocusItem = { kind: 0 };
  private count = 1;
  private serverMs = 0;
  private relightAt = -1;
  private lastState: WritView['state'] | null = null;
  private resultAt = -1;
  private tipVisible = false;
  private placed = '';
  private faceBox = { x: 0, y: 0, w: INNER };
  private fillOn = false;
  private feedOn = false;

  constructor(private readonly host: WritPanelHost) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.face = scene.add.graphics();
    this.rim = body(scene, 0, 0, '', Palette.uiInkMuted);
    this.charge = body(scene, 0, 0, '', Palette.uiInk);
    this.state = body(scene, 0, 0, '', Palette.uiInk);
    this.line1 = body(scene, 0, 0, '', Palette.uiInk);
    this.line2 = body(scene, 0, 0, NEXT_LINE_LINE, Palette.uiInkMuted);
    this.preview = body(scene, 0, 0, '', Palette.spark);
    this.result = body(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    this.countText = label(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    this.tipG = scene.add.graphics().setVisible(false);
    this.tip = body(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    this.chargeZone = scene.add.zone(0, 0, INNER, ROW).setOrigin(0, 0).setInteractive();
    this.chargeZone.on('pointerover', () => {
      this.tipVisible = true;
    });
    this.chargeZone.on('pointerout', () => {
      this.tipVisible = false;
    });
    this.buttonTipG = scene.add.graphics().setVisible(false);
    this.buttonTip = body(scene, 0, 0, '', Palette.uiInk).setVisible(false);
    this.feedButton = button(scene, 0, 0, feedButtonLabel('wild-sliver'), true, () => {
      this.pressFeed();
    });
    this.fillButton = button(scene, 0, 0, FILL, false, () => {
      this.pressFill();
    });
    this.less = button(scene, 0, 0, '-', false, () => {
      this.stepCount(-1);
    });
    this.more = button(scene, 0, 0, '+', false, () => {
      this.stepCount(1);
    });
    const objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth)[] = [
      this.g,
      this.face,
      this.rim,
      this.charge,
      this.state,
      this.line1,
      this.line2,
      this.preview,
      this.result,
      this.countText,
      this.chargeZone,
      this.buttonTipG,
      this.buttonTip,
      this.feedButton.container,
      this.fillButton.container,
      this.less.container,
      this.more.container,
      this.tipG,
      this.tip,
    ];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
    this.tipG.setDepth(DEPTH.cursor - 1);
    this.tip.setDepth(DEPTH.cursor - 1);
    this.buttonTipG.setDepth(DEPTH.cursor - 1);
    this.buttonTip.setDepth(DEPTH.cursor - 1);
  }

  /** The latest answer: the Writ, the inventory, the server's clock; a relight starts when it came back from dark. */
  sync(view: WritView, inventory: InventoryResponse | null, serverMs: number): void {
    const was = this.lastState;
    this.view = view;
    this.inventory = inventory;
    this.serverMs = serverMs;
    this.lastState = view.state;
    const relit = (was === 'dark' || was === 'fading') && (view.state === 'lit' || view.state === 'flickering');
    if (relit) this.relightAt = this.host.scene.time.now;
    this.rebuild();
  }

  /** A refusal's line from the server, with the inventory's blink-and-hold timing. */
  setResult(line: string): void {
    this.result.setText(line).setVisible(true);
    this.resultAt = this.host.scene.time.now;
  }

  private rebuild(): void {
    const view = this.view;
    if (!view) return;
    this.choices = feedChoices(view, this.inventory, this.serverMs);
    const d = derive(view, this.serverMs);
    this.rim.setText(rimLine(view.certified));
    const charge = chargeLines(d);
    this.full = d.full;
    this.buttonTip.setText(d.full ? fullTip(d) : '');
    this.charge.setText(charge ? `Charge: ${charge.words}` : '').setVisible(charge !== null);
    this.tip.setText(charge?.exact ?? '');
    if (charge) this.chargeZone.setInteractive();
    else {
      this.chargeZone.disableInteractive();
      this.tipVisible = false;
    }
    this.state.setText(stateLine(d, this.serverMs));
    const first = d.lines[0];
    this.line1.setText(first ? lineLine(first) : '');
    // Rows for the kinds, made once.
    while (this.rows.length < this.choices.length) {
      const i = this.rows.length;
      const zone = this.host.scene.add.zone(0, 0, INNER, ROW).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.select(i);
        this.focus = { kind: i };
      });
      const row = {
        name: body(this.host.scene, 0, 0, '', Palette.uiInk),
        held: body(this.host.scene, 0, 0, '', Palette.uiInkMuted),
        refusal: body(this.host.scene, 0, 0, '', Palette.uiInkMuted),
        marker: label(this.host.scene, 0, 0, '>', Palette.uiFocus).setVisible(false),
        zone,
      };
      this.rows.push(row);
      const objects = [row.name, row.held, row.refusal, row.marker, row.zone];
      this.host.layer.add(objects);
      for (const o of objects) o.setDepth(DEPTH.prompt);
    }
    this.choices.forEach((c, i) => {
      const row = this.rows[i];
      if (!row) return;
      row.name.setText(c.name).setTint(c.enabled ? Palette.uiInk : Palette.uiInkMuted);
      row.held.setText(heldLine(c));
      row.refusal.setText(c.refusal ?? '');
    });
    if (!this.choices[this.selected]?.enabled) {
      const firstOn = this.choices.findIndex((c) => c.enabled);
      if (firstOn >= 0) this.selected = firstOn;
    }
    this.count = Math.max(1, Math.min(this.count, MAX_COUNT));
    this.placed = '';
    this.syncButtons();
  }

  private select(i: number): void {
    if (this.selected !== i) this.count = 1;
    this.selected = i;
    this.syncButtons();
  }

  private current(): FeedChoice | undefined {
    return this.choices[this.selected];
  }

  /** The preview line and the buttons for the chosen kind (and the gin count). */
  private syncButtons(): void {
    const view = this.view;
    const choice = this.current();
    if (!view || !choice) return;
    const wantCount = takesCount(choice.itemId);
    const previewResult = previewFeed(view, choice.itemId, wantCount ? this.count : 1, this.serverMs);
    this.preview.setText(choice.enabled ? feedLine(previewResult) : (choice.refusal ?? feedLine(previewResult)));
    this.feedOn = choice.enabled && previewResult.ok && choice.have >= previewResult.count;
    this.fillOn = fillEnabled(view, this.choices, this.serverMs);
    const label = feedButtonLabel(choice.itemId, this.count);
    if (label !== this.feedLabel) {
      this.feedLabel = label;
      this.feedButton.container.destroy(true);
      this.feedButton = button(this.host.scene, 0, 0, label, true, () => {
        this.pressFeed();
      });
      this.feedButton.container.setDepth(DEPTH.prompt);
      this.host.layer.add(this.feedButton.container);
    }
    this.countText.setText(wantCount ? `${COUNT_SIGN} ${this.count}` : '').setVisible(wantCount);
    this.feedButton.setEnabled(this.feedOn);
    this.fillButton.setEnabled(this.fillOn);
    this.placed = '';
  }

  private pressFeed(): void {
    const choice = this.current();
    if (!choice || !this.feedOn) return;
    this.host.feed(choice.itemId, takesCount(choice.itemId) ? this.count : 1);
  }

  private pressFill(): void {
    if (!this.fillOn) return;
    this.host.fill();
  }

  // --- Keys and the pad -----------------------------------------------------

  /** Up and down: through the kinds, then the buttons. */
  moveFocus(delta: number): void {
    const n = this.choices.length;
    const items: FocusItem[] = [...this.choices.map((_, i) => ({ kind: i })), { button: 'feed' }, { button: 'fill' }];
    const at = 'kind' in this.focus ? this.focus.kind : n + (this.focus.button === 'feed' ? 0 : 1);
    const next = items[(((at + delta) % items.length) + items.length) % items.length] ?? { kind: 0 };
    this.focus = next;
    if ('kind' in next) this.select(next.kind);
    this.placed = '';
  }

  /** The gin count, 1 to MAX_COUNT. */
  private stepCount(delta: number): void {
    const choice = this.current();
    if (!choice || !takesCount(choice.itemId)) return;
    this.count = Math.max(1, Math.min(MAX_COUNT, this.count + delta));
    this.syncButtons();
  }

  /** Left and right: the gin count on its row, the other button on a button. */
  moveSide(delta: number): void {
    if ('kind' in this.focus) {
      this.stepCount(delta);
      return;
    }
    this.focus = { button: this.focus.button === 'feed' ? 'fill' : 'feed' };
    this.placed = '';
  }

  /** Enter or Cross: a kind row moves on to the feed button; a button presses. */
  press(): void {
    if ('kind' in this.focus) {
      this.select(this.focus.kind);
      this.focus = { button: 'feed' };
      this.placed = '';
      return;
    }
    if (this.focus.button === 'feed') this.pressFeed();
    else this.pressFill();
  }

  // --- Drawing ---------------------------------------------------------------

  private layout(): void {
    const frame = this.host.frame();
    const letters = this.view?.letters ?? '';
    // A Name wider than the face after the lean hand: the face widens to fit, never smaller letters.
    const faceW = Math.max(INNER, shapeLetters(letters).width * SCALE + FACE_PAD * 2);
    const w = Math.max(W, faceW + 2 * PAD);
    const rows = this.choices.length;
    const chargeRows = this.charge.visible ? 1 : 0;
    const h = PAD + FACE_H + 6 + (3 + chargeRows) * ROW + 4 + 1 + 4 + rows * ROW + 4 + ROW + 4 + 15 + 4 + ROW + PAD;
    const x = Math.round(frame.x + frame.w / 2 - w / 2);
    const y = Math.round(frame.y + frame.h / 2 - h / 2);
    const key = `${x},${y},${w},${h},${chargeRows},${this.feedLabel},${this.selected},${JSON.stringify(this.focus)},${this.host.showFocus()}`;
    if (key === this.placed) return;
    this.placed = key;
    this.g.clear();
    panel(this.g, x, y, w, h);
    let ly = y + PAD;
    this.faceBox = { x: x + PAD, y: ly, w: w - 2 * PAD };
    ly += FACE_H + 6;
    place(this.rim, x + PAD, ly);
    ly += ROW;
    if (chargeRows) {
      place(this.charge, x + PAD, ly);
      this.chargeZone.setPosition(x + PAD, ly);
      ly += ROW;
    }
    place(this.state, x + PAD, ly);
    ly += ROW;
    place(this.line1, x + PAD, ly);
    ly += ROW;
    place(this.line2, x + PAD, ly);
    ly += ROW + 4;
    divider(this.g, x + PAD, ly, w - 2 * PAD);
    ly += 1 + 4;
    this.rows.forEach((row, i) => {
      const visible = i < this.choices.length;
      row.name.setVisible(visible);
      row.held.setVisible(visible);
      row.refusal.setVisible(visible);
      row.zone.setPosition(x + PAD, ly);
      if (!visible) return;
      place(row.marker, x + PAD, ly);
      row.marker.setVisible(i === this.selected);
      const focused = this.host.showFocus() && 'kind' in this.focus && this.focus.kind === i;
      row.name.setTint(
        focused ? Palette.uiFocus : i === this.selected ? Palette.spark : this.choices[i]?.enabled ? Palette.uiInk : Palette.uiInkMuted,
      );
      place(row.name, x + PAD + 8, ly);
      const held = this.choices[i]?.refusal ? row.refusal : row.held;
      const other = this.choices[i]?.refusal ? row.held : row.refusal;
      other.setVisible(false);
      place(held, x + w - PAD, ly, 1);
      ly += ROW;
    });
    ly += 4;
    place(this.preview, x + PAD, ly);
    ly += ROW + 4;
    this.feedButton.container.setPosition(x + PAD, ly);
    this.feedButton.setFocused(this.host.showFocus() && 'button' in this.focus && this.focus.button === 'feed');
    let bx = x + PAD + this.feedButton.width + 6;
    const counting = this.countText.visible;
    this.less.container.setVisible(counting);
    this.more.container.setVisible(counting);
    if (counting) {
      this.less.container.setPosition(bx, ly);
      bx += this.less.width + 4;
      place(this.countText, bx, ly + 4);
      bx += Math.round(this.countText.width) + 4;
      this.more.container.setPosition(bx, ly);
      bx += this.more.width + 8;
    }
    this.fillButton.container.setPosition(bx, ly);
    this.fillButton.setFocused(this.host.showFocus() && 'button' in this.focus && this.focus.button === 'fill');
    // While full, hovering the greyed buttons says when a sliver fits again.
    const btw = Math.round(this.buttonTip.width) + 8;
    this.buttonTipG.clear();
    panel(this.buttonTipG, x + PAD, ly + 15 + 2, btw, ROW + 4, { plain: true });
    place(this.buttonTip, x + PAD + 4, ly + 15 + 4);
    ly += 15 + 4;
    place(this.result, x + w - PAD, ly, 1);
    // The charge's tooltip, above its line.
    const tw = Math.round(this.tip.width) + 8;
    this.tipG.clear();
    panel(this.tipG, x + PAD, this.chargeZone.y - ROW - 4, tw, ROW + 4, { plain: true });
    place(this.tip, x + PAD + 4, this.chargeZone.y - ROW - 2);
  }

  /** The face from the derived state at the server's clock, the beat and the relight. */
  private drawFace(now: number): void {
    const f = this.faceBox;
    const g = this.face;
    g.clear();
    panel(g, f.x, f.y, f.w, FACE_H, { plain: true });
    const sheet = this.host.sheet();
    const view = this.view;
    if (!sheet || !view) return;
    const d = derive(view, this.serverMs);
    const relight = this.relightAt >= 0 ? relightProgress(now - this.relightAt, view.lineCount) : null;
    if (relight && relightDone(now - this.relightAt, view.lineCount)) this.relightAt = -1;
    const states = faceStates(d, view.letters ?? '', flickerBeat(now), relight);
    const right = f.x + f.w - FACE_PAD;
    const top = f.y + FACE_PAD;
    plotLetters(g, sheet, EMET, right - shapeLetters(EMET).width * SCALE, top, { scale: SCALE, states: states.emet });
    const letters = view.letters ?? '';
    if (letters !== '') plotLetters(g, sheet, letters, right - shapeLetters(letters).width * SCALE, top + 8 * SCALE + 4, { scale: SCALE, states: states.name });
  }

  /** Every frame: the clock moves on (the state line and the preview follow), the face, the result line's timing. */
  update(serverMs: number): void {
    if (this.view && Math.floor(serverMs / 60_000) !== Math.floor(this.serverMs / 60_000)) {
      this.serverMs = serverMs;
      this.rebuild();
    }
    this.serverMs = serverMs;
    this.layout();
    this.drawFace(this.host.scene.time.now);
    const showTip = this.tipVisible && this.charge.visible;
    this.tipG.setVisible(showTip);
    this.tip.setVisible(showTip);
    const showButtonTip = this.full && (this.feedButton.hover || this.fillButton.hover);
    this.buttonTipG.setVisible(showButtonTip);
    this.buttonTip.setVisible(showButtonTip);
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
    state: string;
    charge: string | null;
    stateLine: string;
    rim: string;
    line1: string;
    kinds: { itemId: string; enabled: boolean; refusal: string | null; held: string }[];
    selected: string;
    preview: string;
    feedOn: boolean;
    fillOn: boolean;
    result: string;
    relighting: boolean;
    tip: string | null;
    count: number;
    full: boolean;
    buttonTip: string | null;
  } {
    return {
      state: this.view?.state ?? '',
      charge: this.charge.visible ? this.charge.text : null,
      stateLine: this.state.text,
      rim: this.rim.text,
      line1: this.line1.text,
      kinds: this.choices.map((c) => ({ itemId: c.itemId, enabled: c.enabled, refusal: c.refusal, held: heldLine(c) })),
      selected: this.current()?.itemId ?? '',
      preview: this.preview.text,
      feedOn: this.feedOn,
      fillOn: this.fillOn,
      result: this.result.visible ? this.result.text : '',
      relighting: this.relightAt >= 0,
      tip: this.tipVisible ? this.tip.text : null,
      count: this.count,
      full: this.full,
      buttonTip: this.full && (this.feedButton.hover || this.fillButton.hover) ? this.buttonTip.text : null,
    };
  }

  destroy(): void {
    for (const o of [this.g, this.face, this.rim, this.charge, this.state, this.line1, this.line2, this.preview, this.result, this.countText, this.chargeZone, this.tipG, this.tip, this.buttonTipG, this.buttonTip])
      o.destroy();
    for (const row of this.rows) for (const o of [row.name, row.held, row.refusal, row.marker, row.zone]) o.destroy();
    this.feedButton.container.destroy(true);
    this.fillButton.container.destroy(true);
    this.less.container.destroy(true);
    this.more.container.destroy(true);
  }
}
