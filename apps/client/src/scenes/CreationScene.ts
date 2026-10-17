import Phaser from 'phaser';
import {
  CREATION_CLAY_TONES,
  creationData,
  DEFAULT_CLAY_TONE,
  REMEMBRANCES,
  validateKindledName,
  type ClayTone,
  type Remembrance,
} from '@iot/shared';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { MENU_BUTTONS, padEdges, padEdgeState, type PadFamily } from '../game/gamepad.js';
import { clayToneColors, Palette, remembranceColor } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { PLAYER_SHEET } from '../render/characters.js';
import { FIELD_H, FieldFrame } from '../render/field.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { animKey, toneTextureKey } from '../render/spriteSheets.js';
import { body, label, place, type Text } from '../render/text.js';
import { panel } from '../render/ui.js';
import { createForm, type DomForm } from '../ui/formFields.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera, uiToCss, type MenuLayout } from '../render/cameras.js';

type Row = 'remembrance' | 'tone' | 'name' | 'confirm';
const ROWS: Row[] = ['remembrance', 'tone', 'name', 'confirm'];

const MARGIN = 15;
const CARD_Y = 40;
const CARD_H = 62;
const CARD_GAP = 6;
const CARD_W = Math.floor((UI_W - 2 * MARGIN - 3 * CARD_GAP) / 4);
const PREVIEW = { x: MARGIN, y: 112, w: 120, h: 100 };
const COL_X = PREVIEW.x + PREVIEW.w + 16;
const TONE_Y = 124;
const SWATCH = 22;
const SWATCH_GAP = 8;
const NAME_Y = 176;
const NAME_W = 200;
const CONFIRM_Y = 222;
/** The sheet every Remembrance wears until their own are drawn: the player's. */
const SHEET = PLAYER_SHEET;

/**
 * Kindled creation (docs/design/accounts.md): pick the Remembrance (four
 * cards with their outfits), pick the clay tone (four swatches; the preview
 * is the placeholder kindled-ash sheet in that tone's palette swap), type
 * the name, confirm. Keyboard: arrows or Tab move between rows and through
 * the choices, typing goes to the name. Pad: the D-pad does the same, Cross
 * confirms (the name needs the keyboard). Placeholder layout until UI-05.
 */
export class CreationScene extends Phaser.Scene {
  private remembrance: Remembrance = 'clay';
  private tone: ClayTone = DEFAULT_CLAY_TONE;
  private row: Row = 'remembrance';
  private busy = false;
  private cards!: Phaser.GameObjects.Graphics;
  private swatches!: Phaser.GameObjects.Graphics;
  private toneName!: Text;
  private preview!: Phaser.GameObjects.Sprite;
  private field!: FieldFrame;
  private form!: DomForm;
  /** Where the 480 × 270 layout sits on the canvas (the DOM inputs line up with it). */
  private layout!: () => MenuLayout;
  private error!: Text;
  private confirm!: Button;
  private marker!: Text;
  private hint!: HintRow;
  private pad = { prev: [] as boolean[] };
  private family: PadFamily = 'ps';

  constructor() {
    super('creation');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.layout = menuCamera(this);
    this.remembrance = REMEMBRANCES[0] ?? 'clay';
    this.tone = DEFAULT_CLAY_TONE;
    this.row = 'remembrance';
    this.busy = false;
    this.pad = padEdgeState();
    const cx = UI_W / 2;
    place(label(this, 0, 0, 'CREATE YOUR KINDLED', Palette.uiInk, 16), cx, 6, 0.5);

    // Remembrance cards.
    label(this, MARGIN, CARD_Y - 11, 'REMEMBRANCE', Palette.uiInkMuted);
    this.cards = this.add.graphics();
    REMEMBRANCES.forEach((id, i) => {
      const x = MARGIN + i * (CARD_W + CARD_GAP);
      const r = creationData.remembrances[id];
      label(this, x + 16, CARD_Y + 7, r.name.toUpperCase());
      body(this, x + 7, CARD_Y + 20, r.outfit, Palette.uiInkMuted, CARD_W - 14);
      this.add
        .zone(x, CARD_Y, CARD_W, CARD_H)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.remembrance = id;
          this.focusRow('remembrance');
        });
    });

    // Preview: the Kindled sprite in the chosen tone, at 1 UI px per sheet px (B's density).
    const g = this.add.graphics();
    panel(g, PREVIEW.x, PREVIEW.y, PREVIEW.w, PREVIEW.h, { plain: true });
    g.fillStyle(Palette.floor, 1).fillRect(
      PREVIEW.x + 4,
      PREVIEW.y + PREVIEW.h - 18,
      PREVIEW.w - 8,
      14,
    );
    g.fillStyle(Palette.floorEdge, 1).fillRect(
      PREVIEW.x + 4,
      PREVIEW.y + PREVIEW.h - 18,
      PREVIEW.w - 8,
      1,
    );
    this.preview = this.add
      .sprite(
        PREVIEW.x + PREVIEW.w / 2,
        PREVIEW.y + PREVIEW.h - 10,
        toneTextureKey(this, SHEET, this.tone),
      );
    this.showTone();

    // Clay tone swatches.
    label(this, COL_X, TONE_Y - 11, 'CLAY TONE', Palette.uiInkMuted);
    this.swatches = this.add.graphics();
    CREATION_CLAY_TONES.forEach((tone, i) => {
      this.add
        .zone(COL_X + i * (SWATCH + SWATCH_GAP), TONE_Y, SWATCH, SWATCH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.setTone(tone);
          this.focusRow('tone');
        });
    });
    this.toneName = body(this, 0, TONE_Y + 4, '', Palette.uiInk);

    // Name.
    label(this, COL_X, NAME_Y - 11, 'NAME', Palette.uiInkMuted);
    this.field = new FieldFrame(this, COL_X, NAME_Y, NAME_W);
    const { minGraphemes, maxGraphemes } = creationData.name;
    this.form = createForm(
      [
        {
          name: 'kindled-name',
          box: this.field.box,
          type: 'text',
          autocomplete: 'off',
          // Room for decomposed accents; the validator counts characters.
          maxLength: maxGraphemes * 4,
          label: 'Kindled name',
        },
      ],
      () => {
        this.send();
      },
      () => {
        this.row = 'name';
      },
    );
    body(
      this,
      COL_X,
      NAME_Y + FIELD_H + 4,
      `${minGraphemes}-${maxGraphemes} letters: A–Z and accented Latin.`,
      Palette.uiInkMuted,
    );
    this.error = body(this, COL_X, NAME_Y + FIELD_H + 16, '', Palette.uiError, UI_W - COL_X - 90);

    this.confirm = button(this, 0, CONFIRM_Y, 'CONFIRM', true, () => {
      this.form.submit();
    });
    this.confirm.container.setX(UI_W - MARGIN - this.confirm.width);
    this.marker = label(this, 0, 0, '>', Palette.uiFocus);
    this.hint = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInkMuted });
    this.family = padFamilyNow();

    this.form.layout(this.game.canvas, uiToCss(this.game.canvas, this.layout()));

    // A click on the canvas takes focus from the input; give it back while the name row is focused.
    this.input.on('pointerup', () => {
      if (this.row === 'name') this.focusRow('name');
    });
    const onKey = (e: KeyboardEvent): void => {
      this.onKey(e);
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.form.destroy();
    });
  }

  private setTone(tone: ClayTone): void {
    this.tone = tone;
    this.showTone();
  }

  private showTone(): void {
    const key = toneTextureKey(this, SHEET, this.tone);
    this.preview.play(animKey(key, 'idle_S'));
  }

  /** Step the choice on the focused row (Remembrance or tone). */
  private cycle(delta: number): void {
    const wrap = <T>(list: readonly T[], current: T): T => {
      const i = Math.max(0, list.indexOf(current));
      return list[(i + delta + list.length) % list.length] ?? current;
    };
    if (this.row === 'remembrance') this.remembrance = wrap(REMEMBRANCES, this.remembrance);
    else if (this.row === 'tone') this.setTone(wrap(CREATION_CLAY_TONES, this.tone));
  }

  /** Move to a row: the name row focuses the input, any other row takes focus off it. */
  private focusRow(row: Row): void {
    this.row = row;
    const input = this.form.input('kindled-name');
    if (row === 'name') input.focus({ preventScroll: true });
    else if (document.activeElement === input) input.blur();
  }

  private step(delta: number): void {
    const i = ROWS.indexOf(this.row);
    this.focusRow(ROWS[(i + delta + ROWS.length) % ROWS.length] ?? 'name');
  }

  private onKey(e: KeyboardEvent): void {
    // Leave keys that compose text (IME) to the input.
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.form.submit();
      return;
    }
    if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.step(e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1);
      return;
    }
    if (
      (this.row === 'remembrance' || this.row === 'tone') &&
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    ) {
      e.preventDefault();
      this.cycle(e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    // Typing on another row goes to the name: focusing the input during keydown sends it the key.
    if (this.row !== 'name' && Array.from(e.key).length === 1 && !e.ctrlKey && !e.metaKey)
      this.focusRow('name');
  }

  private send(): void {
    if (this.busy) return;
    const checked = validateKindledName(this.form.input('kindled-name').value);
    if (!checked.ok) {
      this.error.setText(checked.message);
      this.focusRow('name');
      return;
    }
    this.busy = true;
    this.error.setText('...');
    const request = { name: checked.name, remembrance: this.remembrance, clayTone: this.tone };
    void api.createKindled(request).then((res) => {
      this.busy = false;
      if (res.ok) {
        if (accountStore.current) accountStore.current.kindled = res.value;
        this.scene.start('start');
      } else if (res.error === 'not-signed-in') {
        this.scene.start('account');
      } else if (res.error === 'kindled-exists') {
        // Made elsewhere meanwhile: ask the server again.
        this.scene.start('gate');
      } else {
        this.error.setText(res.message);
      }
    });
  }

  private hintItems(): HintItem[] {
    if (deviceStore.get() === 'gamepad') {
      const menu = (index: number): HintItem[] => glyphs([menuGlyph(index)], this.family);
      return [
        ...menu(MENU_BUTTONS.up),
        ...menu(MENU_BUTTONS.down),
        word('row  ·'),
        ...menu(MENU_BUTTONS.left),
        ...menu(MENU_BUTTONS.right),
        word('choose  ·'),
        ...menu(MENU_BUTTONS.confirm[0]),
        word('confirm  ·  type the name with the keyboard'),
      ];
    }
    return [
      ...glyphs(['Enter'], 'keyboard'),
      word('confirm  ·'),
      ...glyphs(['Tab'], 'keyboard'),
      word('next row  ·'),
      ...glyphs(['Left', 'Right'], 'keyboard'),
      word('choose  ·  type the name'),
    ];
  }

  private draw(): void {
    const g = this.cards;
    g.clear();
    REMEMBRANCES.forEach((id, i) => {
      const x = MARGIN + i * (CARD_W + CARD_GAP);
      const selected = id === this.remembrance;
      panel(g, x, CARD_Y, CARD_W, CARD_H, selected ? {} : { rim: Palette.uiBevel });
      // The outfit's placeholder colour beside the name.
      g.fillStyle(Palette.uiOutline, 1).fillRect(x + 6, CARD_Y + 6, 8, 8);
      g.fillStyle(remembranceColor(id), 1).fillRect(x + 7, CARD_Y + 7, 6, 6);
    });

    const s = this.swatches;
    s.clear();
    CREATION_CLAY_TONES.forEach((tone, i) => {
      const x = COL_X + i * (SWATCH + SWATCH_GAP);
      const { skin, shade } = clayToneColors(tone);
      const selected = tone === this.tone;
      s.fillStyle(selected ? Palette.uiFocus : Palette.uiOutline, 1).fillRect(
        x - 1,
        TONE_Y - 1,
        SWATCH + 2,
        SWATCH + 2,
      );
      s.fillStyle(Palette.uiOutline, 1).fillRect(x, TONE_Y, SWATCH, SWATCH);
      s.fillStyle(skin, 1).fillRect(x + 1, TONE_Y + 1, SWATCH - 2, SWATCH - 2);
      s.fillStyle(shade, 1).fillRect(x + 1, TONE_Y + SWATCH - 7, SWATCH - 2, 6);
    });
    this.toneName.setText(creationData.clayTones[this.tone].name);
    this.toneName.setX(COL_X + CREATION_CLAY_TONES.length * (SWATCH + SWATCH_GAP) + 4);
  }

  override update(): void {
    this.draw();
    const family = padFamilyNow();
    if (family !== this.family) this.family = family;
    this.hint.setItems(this.hintItems()).place(UI_W / 2, UI_H - 18, 0.5);
    menuCursor(this);

    this.form.layout(this.game.canvas, uiToCss(this.game.canvas, this.layout()));
    this.field.focused = this.row === 'name';
    this.field.update();
    this.confirm.setFocused(this.row === 'confirm');
    const markerAt: Record<Row, [number, number]> = {
      remembrance: [MARGIN - 9, CARD_Y + 7],
      tone: [COL_X - 9, TONE_Y + 7],
      name: [COL_X - 9, NAME_Y + 4],
      confirm: [this.confirm.container.x - 9, CONFIRM_Y + 4],
    };
    const [mx, my] = markerAt[this.row];
    this.marker.setPosition(mx, my);

    const edges = padEdges(this.pad);
    if (edges.includes(MENU_BUTTONS.up)) this.step(-1);
    else if (edges.includes(MENU_BUTTONS.down)) this.step(1);
    else if (edges.includes(MENU_BUTTONS.left)) this.cycle(-1);
    else if (edges.includes(MENU_BUTTONS.right)) this.cycle(1);
    else if (MENU_BUTTONS.confirm.some((b) => edges.includes(b))) {
      if (this.row === 'remembrance' || this.row === 'tone') this.step(1);
      else this.form.submit();
    }
  }
}
