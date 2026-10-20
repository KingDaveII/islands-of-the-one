import Phaser from 'phaser';
import {
  CREATION_CLAY_TONES,
  CREATION_TEXT,
  creationData,
  REMEMBRANCES,
  validateKindledName,
  type ClayTone,
  type Remembrance,
} from '@iot/shared';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import {
  activate,
  backEnabled,
  chooseRemembrance,
  chooseTone,
  close,
  dragTurns,
  figureFacing,
  focusRow,
  goBack,
  goNext,
  initialCreation,
  isStep,
  moveFocus,
  NARRATOR_W,
  narratorLine,
  nextLabel,
  press,
  skipOpening,
  tick,
  turnByHand,
  type CreationPhase,
  type CreationState,
  type FocusRow,
} from '../game/creationView.js';
import { MENU_BUTTONS, padEdges, padEdgeState, type PadFamily } from '../game/gamepad.js';
import { UI_H, UI_W } from '../game/view.js';
import { clayToneColors, Palette, remembranceColor } from '../palette.js';
import { button, type Button } from '../render/button.js';
import { menuCamera, uiToCss, type MenuLayout } from '../render/cameras.js';
import { sheathedSheetFor } from '../render/characters.js';
import { FIELD_H, FieldFrame } from '../render/field.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { animKey, toneTextureKey } from '../render/spriteSheets.js';
import { body, label, place, type Text } from '../render/text.js';
import { panel } from '../render/ui.js';
import { createForm, type DomForm } from '../ui/formFields.js';

const MARGIN = 16;
/** The step's line at the top. */
const SCREEN_Y = 8;
/** BACK and NEXT. */
const BUTTON_Y = 198;
/** The Narrator's first row, at the foot over the key hints (two rows at most). */
const NARRATOR_Y = 222;
const HINT_Y = UI_H - 16;

// Remembrance: four cards in a row, the figure under them.
const CARD_Y = 36;
const CARD_GAP = 6;
const CARD_W = Math.floor((UI_W - 2 * MARGIN - 3 * CARD_GAP) / 4);
const CARD_PAD = 6;
const SMALL_FIGURE = { x: UI_W / 2, y: 190, scale: 1 };

// Appearance: the swatches with their names and the tooltip on the left, the figure larger on the right.
const SWATCH_X = MARGIN + 12;
const SWATCH_Y = 56;
const SWATCH = 24;
const SWATCH_STEP = 56;
const TIP_W = 4 * SWATCH_STEP - 8;
const BIG_FIGURE = { x: 356, y: 186, scale: 2 };
/** The figure's drag area (UI px around its feet point). */
const FIGURE_BOX = { w: 120, h: 112 };

// Name: the field on the left, the figure on the right.
const NAME_X = MARGIN + 12;
const NAME_Y = 64;
const NAME_W = 200;

type G = Phaser.GameObjects.Graphics;

/**
 * Kindled creation (docs/design/accounts.md, M2 Task 9; LORE's scene, Lore
 * §14.0): the opening line on black, then three steps with BACK and NEXT,
 * Remembrance (four cards: the image line and the clothing, one figure for
 * the chosen card), Appearance (the clay tones, the figure larger, turning
 * through the 8 facings or by hand) and Name (the DOM name field, CONFIRM),
 * then the closing line on black and the start screen. The Narrator's line
 * sits at the foot, centred, two rows at most. The logic is creationView.ts;
 * this draws it, reads the keyboard, the pad and the pointer, and sends the
 * Kindled. The figure wears the Remembrance's sheathed sheet when it is on
 * disk, else Ash's (`sheathedSheetFor`), in the chosen tone.
 */
export class CreationScene extends Phaser.Scene {
  private s: CreationState = initialCreation(0);
  /** The phase the screen was built for. */
  private built: CreationPhase | null = null;
  /** The current step's objects, rebuilt on every step. */
  private stepObjects: Phaser.GameObjects.GameObject[] = [];
  private busy = false;
  private narrator!: Text;
  private hint!: HintRow;
  private marker!: Text;
  private form!: DomForm;
  /** Where the 480 × 270 layout sits on the canvas (the DOM input lines up with it). */
  private layout!: () => MenuLayout;
  /** The refusal under the field: it stays until the next CONFIRM. */
  private error = '';
  private pad = { prev: [] as boolean[] };
  private family: PadFamily = 'ps';
  // Built per step.
  private cards: G | null = null;
  private swatches: G | null = null;
  private figure: Phaser.GameObjects.Sprite | null = null;
  private turnArrows: [Text, Text] | null = null;
  private field: FieldFrame | null = null;
  private errorText: Text | null = null;
  private back: Button | null = null;
  private next: Button | null = null;
  /** A drag across the Appearance figure: where the last turn was taken (UI px). */
  private drag: { anchorX: number } | null = null;

  constructor() {
    super('creation');
  }

  create(): void {
    this.layout = menuCamera(this);
    const now = this.time.now;
    this.s = initialCreation(now);
    this.built = null;
    this.stepObjects = [];
    this.busy = false;
    this.error = '';
    this.drag = null;
    this.pad = padEdgeState();
    this.family = padFamilyNow();

    this.narrator = body(this, 0, NARRATOR_Y, '', Palette.uiInkMuted, NARRATOR_W).setCenterAlign().setDepth(1);
    this.hint = new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInkMuted });
    this.marker = label(this, 0, 0, '>', Palette.uiFocus).setDepth(1);

    // The name field: one DOM form for the whole scene, shown on the Name step only, so the name is kept across steps.
    const { maxGraphemes } = creationData.name;
    this.form = createForm(
      [
        {
          name: 'kindled-name',
          box: { x: NAME_X, y: NAME_Y, w: NAME_W, h: FIELD_H },
          type: 'text',
          autocomplete: 'off',
          // Room for decomposed accents; the validator counts characters.
          maxLength: maxGraphemes * 4,
          label: 'Kindled name',
        },
      ],
      () => {
        if (this.s.phase === 'name') this.confirm();
      },
      () => {
        this.apply(focusRow(this.s, 'field'));
      },
    );

    // Any press or tap ends the opening; a click on the canvas takes focus from the input, so give it back.
    this.input.on('pointerdown', () => {
      if (this.s.phase === 'opening') this.apply(skipOpening(this.s, this.time.now));
    });
    this.input.on('pointerup', () => {
      this.drag = null;
      if (this.s.phase === 'name' && this.s.focus === 'field') this.nameInput().focus({ preventScroll: true });
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || !p.isDown) return;
      const { turns, anchorX } = dragTurns(this.drag.anchorX, p.worldX);
      this.drag.anchorX = anchorX;
      if (turns !== 0) this.apply(turnByHand(this.s, turns, this.time.now));
    });
    const onKey = (e: KeyboardEvent): void => {
      this.onKey(e);
    };
    window.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      this.form.destroy();
    });
    this.build();
  }

  /** What the scene shows, for playtests (tools/screenshots-m2-9.mjs). */
  snapshot(): {
    phase: CreationPhase;
    focus: FocusRow;
    remembrance: Remembrance;
    tone: ClayTone;
    narrator: string | null;
    facing: string;
    manualTurn: boolean;
    sheet: string;
    error: string;
    busy: boolean;
  } {
    return {
      phase: this.s.phase,
      focus: this.s.focus,
      remembrance: this.s.remembrance,
      tone: this.s.tone,
      narrator: narratorLine(this.s),
      facing: figureFacing(this.s, this.time.now),
      manualTurn: this.s.turn.manual,
      sheet: sheathedSheetFor(this.s.remembrance),
      error: this.error,
      busy: this.busy,
    };
  }

  private nameInput(): HTMLInputElement {
    return this.form.input('kindled-name');
  }

  /** Take a new state: rebuild the screen when the phase changed, and move the DOM focus with the focus row. */
  private apply(next: CreationState): void {
    this.s = next;
    if (this.s.phase !== this.built) this.build();
    const input = this.nameInput();
    if (this.s.phase === 'name' && this.s.focus === 'field') {
      if (document.activeElement !== input) input.focus({ preventScroll: true });
    } else if (document.activeElement === input) input.blur();
  }

  /** Build the screen for the current phase: black with the Narrator, or a step. */
  private build(): void {
    for (const o of this.stepObjects) o.destroy();
    this.stepObjects = [];
    this.cards = this.swatches = null;
    this.figure = null;
    this.turnArrows = null;
    this.field?.destroy();
    this.field = null;
    this.errorText = null;
    this.back = this.next = null;
    this.drag = null;
    this.built = this.s.phase;
    const phase = this.s.phase;
    this.cameras.main.setBackgroundColor(isStep(phase) ? Palette.hollow : Palette.uiBlack);
    this.form.form.style.display = phase === 'name' ? '' : 'none';
    if (!isStep(phase)) return;

    this.keep(body(this, MARGIN, SCREEN_Y, CREATION_TEXT.screens[phase], Palette.uiInk, UI_W - 2 * MARGIN));
    if (phase === 'remembrance') this.buildRemembrance();
    else if (phase === 'appearance') this.buildAppearance();
    else this.buildName();

    const back = button(this, MARGIN, BUTTON_Y, 'BACK', false, () => {
      this.apply(goBack(this.s, this.time.now));
    });
    back.setEnabled(backEnabled(phase));
    const next = button(this, 0, BUTTON_Y, nextLabel(phase), true, () => {
      this.onNext();
    });
    next.container.setX(UI_W - MARGIN - next.width);
    this.keep(back.container, next.container);
    this.back = back;
    this.next = next;
  }

  private keep(...objects: Phaser.GameObjects.GameObject[]): void {
    this.stepObjects.push(...objects);
  }

  private buildRemembrance(): void {
    this.cards = this.add.graphics();
    this.keep(this.cards);
    const inner = CARD_W - 2 * CARD_PAD;
    let cardH = 0;
    REMEMBRANCES.forEach((id, i) => {
      const x = MARGIN + i * (CARD_W + CARD_GAP);
      const r = CREATION_TEXT.remembrances[id];
      const name = label(this, x + CARD_PAD + 10, CARD_Y + CARD_PAD + 1, r.name.toUpperCase());
      const image = body(this, x + CARD_PAD, CARD_Y + 20, r.image, Palette.uiInkMuted, inner);
      const clothing = body(this, x + CARD_PAD, Math.round(image.y + image.height + 5), r.clothing, Palette.uiInk, inner);
      this.keep(name, image, clothing);
      cardH = Math.max(cardH, Math.round(clothing.y + clothing.height + CARD_PAD - CARD_Y));
    });
    REMEMBRANCES.forEach((id, i) => {
      const x = MARGIN + i * (CARD_W + CARD_GAP);
      const zone = this.add.zone(x, CARD_Y, CARD_W, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone
        .on('pointerdown', () => {
          this.apply(chooseRemembrance(this.s, id));
        })
        .on('pointerover', () => {
          this.s = { ...this.s, hover: 'card' };
        })
        .on('pointerout', () => {
          this.s = { ...this.s, hover: null };
        });
      this.keep(zone);
    });
    this.cards.setData('h', cardH);
    this.makeFigure(SMALL_FIGURE);
  }

  private buildAppearance(): void {
    this.keep(label(this, SWATCH_X, SWATCH_Y - 12, 'CLAY TONE', Palette.uiInkMuted));
    this.swatches = this.add.graphics();
    this.keep(this.swatches);
    CREATION_CLAY_TONES.forEach((tone, i) => {
      const x = SWATCH_X + i * SWATCH_STEP;
      const name = place(
        body(this, 0, 0, creationData.clayTones[tone].name, Palette.uiInk),
        x + SWATCH / 2,
        SWATCH_Y + SWATCH + 5,
        0.5,
      );
      const zone = this.add
        .zone(x - 4, SWATCH_Y - 4, SWATCH + 8, SWATCH + 22)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone
        .on('pointerdown', () => {
          this.apply(chooseTone(this.s, tone));
        })
        .on('pointerover', () => {
          this.s = { ...this.s, hover: 'tone' };
        })
        .on('pointerout', () => {
          this.s = { ...this.s, hover: null };
        });
      this.keep(name, zone);
    });
    this.keep(body(this, SWATCH_X - 4, SWATCH_Y + SWATCH + 22, CREATION_TEXT.toneTip, Palette.uiInkMuted, TIP_W));

    this.makeFigure(BIG_FIGURE);
    const { x, y } = BIG_FIGURE;
    const left = place(label(this, 0, 0, '<', Palette.uiInkMuted), x - FIGURE_BOX.w / 2, y - 44, 0, 0.5);
    const right = place(label(this, 0, 0, '>', Palette.uiInkMuted), x + FIGURE_BOX.w / 2, y - 44, 1, 0.5);
    this.turnArrows = [left, right];
    // A drag across the figure turns it, one facing per DRAG_TURN_PX.
    const zone = this.add
      .zone(x - FIGURE_BOX.w / 2, y - FIGURE_BOX.h + 8, FIGURE_BOX.w, FIGURE_BOX.h)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.apply(focusRow(this.s, 'figure'));
      this.drag = { anchorX: p.worldX };
    });
    this.keep(left, right, zone);
  }

  private buildName(): void {
    this.keep(label(this, NAME_X, NAME_Y - 12, 'NAME', Palette.uiInkMuted));
    this.field = new FieldFrame(this, NAME_X, NAME_Y, NAME_W);
    const { minGraphemes, maxGraphemes } = creationData.name;
    this.keep(
      body(this, NAME_X, NAME_Y + FIELD_H + 4, `${minGraphemes}-${maxGraphemes} letters: A–Z and accented Latin.`, Palette.uiInkMuted),
    );
    this.errorText = body(this, NAME_X, NAME_Y + FIELD_H + 18, this.error, Palette.uiError, NAME_W + 40);
    this.keep(this.errorText);
    this.makeFigure(BIG_FIGURE);
    this.form.layout(this.game.canvas, uiToCss(this.game.canvas, this.layout()));
  }

  /** The figure: the chosen Remembrance's sheathed sheet (or Ash's) in the chosen tone, standing on a strip of floor. */
  private makeFigure(at: { x: number; y: number; scale: number }): void {
    const g = this.add.graphics();
    const w = 44 * at.scale;
    g.fillStyle(Palette.floorEdge, 1).fillRect(Math.round(at.x - w / 2), at.y, w, 1);
    g.fillStyle(Palette.floor, 1).fillRect(Math.round(at.x - w / 2), at.y + 1, w, 2 * at.scale);
    this.figure = this.add.sprite(at.x, at.y + 1, this.figureTexture()).setScale(at.scale);
    this.keep(g, this.figure);
  }

  private figureTexture(): string {
    return toneTextureKey(this, sheathedSheetFor(this.s.remembrance), this.s.tone);
  }

  private onNext(): void {
    if (this.busy) return;
    if (this.s.phase === 'name') this.form.submit();
    else this.apply(goNext(this.s, this.time.now));
  }

  private onKey(e: KeyboardEvent): void {
    if (e.repeat && this.s.phase === 'opening') return;
    if (this.s.phase === 'opening') {
      e.preventDefault();
      this.apply(skipOpening(this.s, this.time.now));
      return;
    }
    if (!isStep(this.s.phase) || this.busy) return;
    const now = this.time.now;
    const inField = this.s.phase === 'name' && document.activeElement === this.nameInput();
    if (e.key === 'Escape') {
      e.preventDefault();
      this.apply(goBack(this.s, now));
      return;
    }
    if (e.key === 'Enter') {
      // In the field, Enter submits the form itself.
      if (inField) return;
      e.preventDefault();
      if (activate(this.s) === 'back') this.apply(goBack(this.s, now));
      else this.onNext();
      return;
    }
    if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.apply(moveFocus(this.s, e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1));
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && this.s.focus !== 'field') {
      e.preventDefault();
      this.apply(press(this.s, e.key === 'ArrowLeft' ? -1 : 1, now));
      return;
    }
    // Typing on another row of the Name step goes to the name: focusing the input during keydown sends it the key.
    if (this.s.phase === 'name' && !inField && Array.from(e.key).length === 1 && !e.ctrlKey && !e.metaKey)
      this.apply(focusRow(this.s, 'field'));
  }

  /** CONFIRM: the name checked here first (the server checks it again), then the Kindled made and the closing line. */
  private confirm(): void {
    if (this.busy) return;
    const checked = validateKindledName(this.nameInput().value);
    if (!checked.ok) {
      this.refuse(checked.message);
      return;
    }
    this.busy = true;
    this.setError('...');
    const request = { name: checked.name, remembrance: this.s.remembrance, clayTone: this.s.tone };
    void api.createKindled(request).then((res) => {
      this.busy = false;
      if (res.ok) {
        if (accountStore.current) accountStore.current.kindled = res.value;
        this.setError('');
        this.apply(close(this.s, this.time.now));
      } else if (res.error === 'not-signed-in') {
        this.scene.start('account');
      } else if (res.error === 'kindled-exists') {
        // Made elsewhere meanwhile: ask the server again.
        this.scene.start('gate');
      } else {
        this.refuse(res.message);
      }
    });
  }

  /** A refusal under the field, in the error token; the step stays. */
  private refuse(message: string): void {
    this.setError(message);
    this.apply(focusRow(this.s, 'field'));
  }

  private setError(message: string): void {
    this.error = message;
    this.errorText?.setText(message);
  }

  private hintItems(): HintItem[] {
    if (!isStep(this.s.phase)) return [];
    // On touch the hints hide: the cards, the swatches, BACK and NEXT are tapped, the figure dragged (M2 Task 10).
    if (deviceStore.get() === 'touch') return [];
    const choose = this.s.focus === 'figure' ? 'turn' : 'choose';
    if (deviceStore.get() === 'gamepad') {
      const menu = (index: number): HintItem[] => glyphs([menuGlyph(index)], this.family);
      const items = [
        ...menu(MENU_BUTTONS.up),
        ...menu(MENU_BUTTONS.down),
        word('row  ·'),
        ...menu(MENU_BUTTONS.left),
        ...menu(MENU_BUTTONS.right),
        word(`${choose}  ·`),
        ...menu(MENU_BUTTONS.confirm[0]),
        word(`${nextLabel(this.s.phase).toLowerCase()}  ·`),
        ...menu(MENU_BUTTONS.back),
        word('back'),
      ];
      return this.s.phase === 'name' ? [...items, word('·  type the name with the keyboard')] : items;
    }
    return [
      ...glyphs(['Enter'], 'keyboard'),
      word(`${nextLabel(this.s.phase).toLowerCase()}  ·`),
      ...glyphs(['Esc'], 'keyboard'),
      word('back  ·'),
      ...glyphs(['Tab'], 'keyboard'),
      word('row  ·'),
      ...(this.s.phase === 'name' ? [word('type the name')] : [...glyphs(['Left', 'Right'], 'keyboard'), word(choose)]),
    ];
  }

  private draw(): void {
    const s = this.s;
    if (this.cards) {
      const g = this.cards;
      const h = this.cards.getData('h') as number;
      g.clear();
      REMEMBRANCES.forEach((id, i) => {
        const x = MARGIN + i * (CARD_W + CARD_GAP);
        panel(g, x, CARD_Y, CARD_W, h, id === s.remembrance ? {} : { rim: Palette.uiBevel });
        // The clothing's placeholder colour beside the name.
        g.fillStyle(Palette.uiOutline, 1).fillRect(x + CARD_PAD, CARD_Y + CARD_PAD, 8, 8);
        g.fillStyle(remembranceColor(id), 1).fillRect(x + CARD_PAD + 1, CARD_Y + CARD_PAD + 1, 6, 6);
      });
    }
    if (this.swatches) {
      const g = this.swatches;
      g.clear();
      CREATION_CLAY_TONES.forEach((tone, i) => {
        const x = SWATCH_X + i * SWATCH_STEP;
        const { skin, shade } = clayToneColors(tone);
        g.fillStyle(tone === s.tone ? Palette.uiFocus : Palette.uiOutline, 1).fillRect(x - 1, SWATCH_Y - 1, SWATCH + 2, SWATCH + 2);
        g.fillStyle(Palette.uiOutline, 1).fillRect(x, SWATCH_Y, SWATCH, SWATCH);
        g.fillStyle(skin, 1).fillRect(x + 1, SWATCH_Y + 1, SWATCH - 2, SWATCH - 2);
        g.fillStyle(shade, 1).fillRect(x + 1, SWATCH_Y + SWATCH - 7, SWATCH - 2, 6);
      });
    }
    if (this.figure) {
      const key = animKey(this.figureTexture(), `idle_${figureFacing(s, this.time.now)}`);
      if (this.figure.anims.currentAnim?.key !== key && this.anims.exists(key)) this.figure.play(key);
    }
    if (this.turnArrows) for (const t of this.turnArrows) t.setTint(s.focus === 'figure' ? Palette.uiFocus : Palette.uiInkMuted);
    if (this.field) {
      this.field.focused = s.focus === 'field';
      this.field.update();
    }
    this.back?.setFocused(s.focus === 'back');
    this.next?.setFocused(s.focus === 'next');

    const marker = this.markerAt(s.focus);
    this.marker.setVisible(marker !== null);
    if (marker) this.marker.setPosition(marker[0], marker[1]);

    const line = narratorLine(s) ?? '';
    if (this.narrator.text !== line) this.narrator.setText(line);
    place(this.narrator, UI_W / 2, NARRATOR_Y, 0.5);
    this.hint.setItems(this.hintItems()).place(UI_W / 2, HINT_Y, 0.5);
    this.hint.container.setVisible(isStep(s.phase));
  }

  /** Where the focus marker goes for a row; none on the buttons (their outline lights). */
  private markerAt(row: FocusRow): [number, number] | null {
    if (!isStep(this.s.phase)) return null;
    switch (row) {
      case 'cards':
        return [MARGIN - 9, CARD_Y + CARD_PAD];
      case 'tones':
        return [SWATCH_X - 12, SWATCH_Y + 8];
      case 'figure':
        return null;
      case 'field':
        return [NAME_X - 10, NAME_Y + 4];
      case 'back':
      case 'next':
        return null;
    }
  }

  override update(): void {
    const now = this.time.now;
    const ticked = tick(this.s, now);
    if (ticked !== this.s) this.apply(ticked);
    if (this.s.phase === 'done') {
      this.scene.start('start');
      return;
    }
    if (this.s.phase === 'name') {
      const value = this.nameInput().value;
      const nameEmpty = value.trim() === '';
      if (nameEmpty !== this.s.nameEmpty) this.s = { ...this.s, nameEmpty };
      this.form.layout(this.game.canvas, uiToCss(this.game.canvas, this.layout()));
    }
    const family = padFamilyNow();
    if (family !== this.family) this.family = family;
    menuCursor(this);
    this.draw();

    const edges = padEdges(this.pad);
    if (edges.length === 0) return;
    if (this.s.phase === 'opening') {
      this.apply(skipOpening(this.s, now));
      return;
    }
    if (!isStep(this.s.phase) || this.busy) return;
    if (edges.includes(MENU_BUTTONS.up)) this.apply(moveFocus(this.s, -1));
    else if (edges.includes(MENU_BUTTONS.down)) this.apply(moveFocus(this.s, 1));
    else if (edges.includes(MENU_BUTTONS.left)) this.apply(press(this.s, -1, now));
    else if (edges.includes(MENU_BUTTONS.right)) this.apply(press(this.s, 1, now));
    else if (edges.includes(MENU_BUTTONS.back)) this.apply(goBack(this.s, now));
    else if (MENU_BUTTONS.confirm.some((b) => edges.includes(b))) {
      if (activate(this.s) === 'back') this.apply(goBack(this.s, now));
      else this.onNext();
    }
  }
}
