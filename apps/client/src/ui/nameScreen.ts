import type Phaser from 'phaser';
import { creationData, shapeLetters, SLEEP_TEXT, validateIslandName } from '@iot/shared';
import type { Rect as ViewRect } from '../game/view.js';
import {
  EMET,
  flareDone,
  flareStates,
  lettersOf,
  NAME_BODY,
  NAME_CONFIRM,
  NAME_TITLE,
  TABLET_TIP,
  tabletLetters,
  tabletStates,
} from '../game/writView.js';
import { Palette } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { DEPTH } from '../render/depth.js';
import { FIELD_H, FieldFrame } from '../render/field.js';
import { plotLetters, type LetterSheet, type LetterState } from '../render/letters.js';
import { body, label, place, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';
import { createForm, type DomForm, type UiToCss } from './formFields.js';

/** The screen's panel (UI px). */
const W = 240;
const PAD = 8;
const INNER = W - 2 * PAD;
/** The tablet's letters are drawn at 2 UI px per sheet px. */
const SCALE = 2;
const TABLET_PAD = 6;
const TABLET_H = TABLET_PAD * 2 + 8 * SCALE * 2 + 4;
/** How long a newly cut letter stays ember before it settles lit while typing. */
const CUT_EMBER_MS = 350;

export interface NameScreenHost {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Layer;
  /** The world view's rectangle in UI px: the screen sits over its centre. */
  frame(): Readonly<ViewRect>;
  /** How the UI grid maps to CSS px, for the DOM input. */
  cssMap(): UiToCss;
  sheet(): LetterSheet | null;
  /** SLEEP: lie down by the Writ (M2 Task 7); the button is here too, so sleep is reachable before the island is named. */
  sleep(): void;
  /** The player confirmed a Name: send it; the server's answer decides. */
  submit(name: string): void;
}

/**
 * The Name screen (docs/design/holding.md "The Writ", LORE §14.3): "Name your
 * island.", the body line, one DOM input (phones, IME and paste work), the
 * tablet drawn live as `hearName` hears the typed Name (אמת on the top line,
 * the Name below, right to left, each new letter ember; its tooltip says it
 * is cut as it sounds), and a confirm button. A refusal shows its message in
 * one line. When the Name is accepted each letter flares ember and settles
 * lit, whole frames, no alpha; then the scene closes it.
 */
export class NameScreen {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly tablet: Phaser.GameObjects.Graphics;
  private readonly title: Text;
  private readonly bodyText: Text;
  private readonly error: Text;
  private readonly tip: Text;
  private readonly tipG: Phaser.GameObjects.Graphics;
  private readonly tabletZone: Phaser.GameObjects.Zone;
  private readonly confirm: Button;
  private readonly sleep: Button;
  private readonly sleepHint: Text;
  private readonly form: DomForm;
  private field: FieldFrame | null = null;
  private placed = '';
  private tabletBox = { x: 0, y: 0, w: INNER, h: TABLET_H };
  private typed = '';
  private letters = '';
  private previous = '';
  private cutAt = -1;
  private accepted: string | null = null;
  private acceptedAt = 0;
  private busy = false;
  private tipVisible = false;
  /** Once the accepted Name's flare is over: the scene closes the screen. */
  done = false;

  constructor(private readonly host: NameScreenHost) {
    const { scene, layer } = host;
    this.g = scene.add.graphics();
    this.tablet = scene.add.graphics();
    this.title = label(scene, 0, 0, NAME_TITLE, Palette.uiInk, 16);
    this.bodyText = body(scene, 0, 0, NAME_BODY, Palette.uiInkMuted, INNER);
    this.error = body(scene, 0, 0, '', Palette.uiError, INNER);
    this.tipG = scene.add.graphics().setVisible(false);
    this.tip = body(scene, 0, 0, TABLET_TIP, Palette.uiInk, INNER - 8).setVisible(false);
    this.tabletZone = scene.add.zone(0, 0, INNER, TABLET_H).setOrigin(0, 0).setInteractive();
    this.tabletZone.on('pointerover', () => {
      this.tipVisible = true;
    });
    this.tabletZone.on('pointerout', () => {
      this.tipVisible = false;
    });
    this.confirm = button(scene, 0, 0, NAME_CONFIRM, true, () => {
      this.form.submit();
    });
    this.sleep = button(scene, 0, 0, SLEEP_TEXT.SLEEP, false, () => {
      host.sleep();
    });
    this.sleepHint = body(scene, 0, 0, SLEEP_TEXT.HINT, Palette.uiInkMuted, INNER);
    this.form = createForm(
      [
        {
          name: 'island-name',
          box: { x: 0, y: 0, w: INNER, h: FIELD_H },
          type: 'text',
          autocomplete: 'off',
          // Room for decomposed accents; the validator counts characters.
          maxLength: creationData.name.maxGraphemes * 4,
          label: 'Island name',
        },
      ],
      () => {
        this.send();
      },
      () => undefined,
    );
    const objects = [this.g, this.tablet, this.title, this.bodyText, this.error, this.tabletZone, this.confirm.container, this.sleep.container, this.sleepHint, this.tipG, this.tip];
    layer.add(objects);
    for (const o of objects) o.setDepth(DEPTH.prompt);
    this.tipG.setDepth(DEPTH.cursor - 1);
    this.tip.setDepth(DEPTH.cursor - 1);
    this.focus();
  }

  /** Put the caret in the input. */
  focus(): void {
    this.form.input('island-name').focus({ preventScroll: true });
  }

  /** The screen is waiting for the server: no second send. */
  setBusy(busy: boolean): void {
    this.busy = busy;
  }

  /** A refusal's line, from the server (or the validator before sending). */
  setError(message: string): void {
    this.error.setText(message);
    this.busy = false;
  }

  /** The server accepted the Name: flare each letter ember, settle lit, then `done`. */
  accept(letters: string): void {
    this.accepted = letters;
    this.acceptedAt = this.host.scene.time.now;
    this.error.setText('');
    this.form.input('island-name').blur();
  }

  private send(): void {
    if (this.busy || this.accepted !== null) return;
    const checked = validateIslandName(this.form.input('island-name').value);
    if (!checked.ok) {
      this.setError(checked.message);
      this.focus();
      return;
    }
    this.busy = true;
    this.error.setText('');
    this.host.submit(checked.name);
  }

  /** The panel over the view's centre; the field is rebuilt when it moves (its box is fixed at creation). */
  private layout(): void {
    const frame = this.host.frame();
    const bodyH = Math.round(this.bodyText.height);
    const hintH = Math.round(this.sleepHint.height);
    const h = PAD + 18 + 4 + bodyH + 6 + TABLET_H + 8 + FIELD_H + 4 + 11 + 6 + 15 + 4 + 1 + 4 + 15 + 3 + hintH + PAD;
    const x = Math.round(frame.x + frame.w / 2 - W / 2);
    const y = Math.round(frame.y + frame.h / 2 - h / 2);
    const key = `${x},${y},${h}`;
    if (key === this.placed) return;
    this.placed = key;
    this.g.clear();
    panel(this.g, x, y, W, h);
    let ly = y + PAD;
    place(this.title, x + PAD, ly);
    ly += 18 + 4;
    place(this.bodyText, x + PAD, ly);
    ly += bodyH + 6;
    this.tabletBox = { x: x + PAD, y: ly, w: INNER, h: TABLET_H };
    this.tabletZone.setPosition(x + PAD, ly);
    ly += TABLET_H + 8;
    this.field?.destroy();
    this.field = new FieldFrame(this.host.scene, x + PAD, ly, INNER);
    this.field.focused = true;
    this.host.layer.add(this.field.graphics);
    this.field.graphics.setDepth(DEPTH.prompt);
    this.form.setBox('island-name', { x: x + PAD, y: ly, w: INNER, h: FIELD_H });
    ly += FIELD_H + 4;
    place(this.error, x + PAD, ly);
    ly += 11 + 6;
    this.confirm.container.setPosition(x + W - PAD - this.confirm.width, ly);
    // The foot: SLEEP and its hint (M2 Task 7), as on the Writ panel.
    ly += 15 + 4;
    divider(this.g, x + PAD, ly, W - 2 * PAD);
    ly += 1 + 4;
    this.sleep.container.setPosition(x + PAD, ly);
    ly += 15 + 3;
    place(this.sleepHint, x + PAD, ly);
    this.placeTip();
  }

  private placeTip(): void {
    const t = this.tabletBox;
    const h = Math.round(this.tip.height) + 8;
    const x = t.x;
    const y = t.y - h - 2;
    this.tipG.clear();
    panel(this.tipG, x, y, t.w, h, { plain: true });
    place(this.tip, x + 4, y + 4);
  }

  /** The tablet: emet on the top line, the Name on the line below, right to left, at 2 px per sheet px. */
  private drawTablet(now: number): void {
    const t = this.tabletBox;
    const g = this.tablet;
    g.clear();
    panel(g, t.x, t.y, t.w, t.h, { plain: true });
    const sheet = this.host.sheet();
    if (!sheet) return;
    const right = t.x + t.w - TABLET_PAD;
    const top = t.y + TABLET_PAD;
    plotLetters(g, sheet, EMET, right - shapeLetters(EMET).width * SCALE, top, { scale: SCALE, state: this.accepted ? 'lit' : 'ember' });
    const letters = this.accepted ?? this.letters;
    if (letters === '') return;
    const w = shapeLetters(letters).width;
    let states: LetterState[];
    if (this.accepted !== null) states = flareStates(lettersOf(this.accepted).length, now - this.acceptedAt);
    else if (now - this.cutAt < CUT_EMBER_MS) states = tabletStates(this.previous, letters);
    else states = lettersOf(letters).map(() => 'lit');
    plotLetters(g, sheet, letters, right - w * SCALE, top + 8 * SCALE + 4, { scale: SCALE, states });
  }

  /** Every frame: the typed Name heard live, the tablet, the DOM input over the canvas, the flare's end. */
  update(canvas: HTMLCanvasElement): void {
    this.layout();
    const typed = this.form.input('island-name').value;
    if (typed !== this.typed) {
      this.typed = typed;
      const letters = tabletLetters(typed);
      if (letters !== this.letters) {
        this.previous = this.letters;
        this.letters = letters;
        this.cutAt = this.host.scene.time.now;
      }
    }
    const now = this.host.scene.time.now;
    this.drawTablet(now);
    this.form.layout(canvas, this.host.cssMap());
    if (this.field) {
      this.field.focused = this.accepted === null && document.activeElement === this.form.input('island-name');
      this.field.update();
    }
    this.confirm.setFocused(false);
    const showTip = this.tipVisible && this.accepted === null;
    this.tipG.setVisible(showTip);
    this.tip.setVisible(showTip);
    if (this.accepted !== null && flareDone(lettersOf(this.accepted).length, now - this.acceptedAt)) this.done = true;
  }

  /** What the playtests read. */
  snapshot(): { typed: string; letters: string; error: string; accepted: string | null; tip: boolean } {
    return { typed: this.typed, letters: this.letters, error: this.error.text, accepted: this.accepted, tip: this.tipVisible };
  }

  destroy(): void {
    this.form.destroy();
    this.field?.destroy();
    for (const o of [this.g, this.tablet, this.title, this.bodyText, this.error, this.tabletZone, this.tipG, this.tip, this.sleepHint]) o.destroy();
    this.confirm.container.destroy(true);
    this.sleep.container.destroy(true);
  }
}
