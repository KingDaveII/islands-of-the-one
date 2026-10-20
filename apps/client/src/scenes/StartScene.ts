import Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import type { Tuning } from '@iot/sim';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { controlsStore } from '../game/controlsStore.js';
import { buttonsFor, glyphsFor, MENU_BUTTONS, padEdges, padEdgeState, type PadFamily } from '../game/gamepad.js';
import { eventKeyFor, keyboardBinding } from '../game/keyboard.js';
import { parseSeed, randomSeed } from '../game/seed.js';
import { displayable } from '../game/drawable.js';
import { startWeapon } from '../game/rackView.js';
import { tuningStore } from '../game/tuningStore.js';
import { Palette } from '../palette.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { button } from '../render/button.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { groundShadow } from '../render/pixels.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, label, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { panel } from '../render/ui.js';
import { drawKindled } from '../render/world.js';
import { buildLabel } from '../ui/buildLabel.js';
import type { GameData } from './GameScene.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera } from '../render/cameras.js';

const MAX_SEED_LEN = 16;
/** The run's weapon, where the picker stood (M2 Task 8: the rack decides): the name, and LORE's line under it. */
const WEAPON_Y = 62;
const WEAPON_H = 40;
/** The hint panel over the shore strip: centered right of the Kindled, two 12 px rows on a 14 px pitch. */
const HINT_PANEL_CX = 282;
const HINT_PANEL_Y = UI_H - 40;
const HINT_PANEL_PAD = 6;

/**
 * Start screen: the holding (the main action), or the M1 run (START RUN, the
 * combat test bed until boats give the holding its landing) with the weapon
 * the rack decides (M2 Task 8, docs/design/holding.md "The weapon rack"):
 * `rack.chosen` from a holding answer fetched when the screen opens, its
 * name where the weapon picker stood with LORE's "Taken from your weapon
 * rack." under it; without an answer (the server is down) the roster's first
 * weapon that can fight, and the line says nothing. Keep or type a seed. The
 * signed-in Kindled shows top right, with the log-out button (Esc, Circle).
 */
export class StartScene extends Phaser.Scene {
  seedText = '';
  weapon = 'hookblade';
  /** The line under the weapon's name: LORE's when it came from the rack, else nothing (playtests read it). */
  weaponLine: string | null = null;
  private field!: Text;
  private caret!: Phaser.GameObjects.Rectangle;
  private weaponName!: Text;
  private weaponNote!: Text;
  private alive = false;
  private pad = { prev: [] as boolean[] };
  /** The two hint lines (the active device's bindings, then the menu keys) and the pad family they are drawn in. */
  private hintRows: HintRow[] = [];
  /** The plain panel behind the hint lines (the ink needs ui-panel under it, not the pale floor). */
  private hintPanel!: Phaser.GameObjects.Graphics;
  private padFamily: PadFamily = 'ps';
  private loggingOut = false;

  constructor() {
    super('start');
  }

  preload(): void {
    preloadSheets(this);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    menuCamera(this);
    this.seedText = String(randomSeed());
    this.pad = padEdgeState();
    this.loggingOut = false;
    this.alive = true;
    const t: Tuning = tuningStore.get();
    const cx = UI_W / 2;

    const bg = this.add.graphics();
    bg.fillStyle(Palette.floor, 1).fillRect(0, UI_H - 34, UI_W, 34);
    bg.fillStyle(Palette.floorEdge, 1);
    for (let x = 0; x < UI_W; x++) if (x % 2 === 0) bg.fillRect(x, UI_H - 34, 1, 1);
    bg.fillRect(0, UI_H - 35, UI_W, 1);

    place(label(this, 0, 0, 'ISLANDS OF THE ONE', Palette.uiInk, 24), cx, 10, 0.5);
    place(label(this, 0, 0, 'M1 COMBAT PROTOTYPE', Palette.uiInkMuted), cx, 36, 0.5);

    // Who is signed in, and the way out.
    const me = accountStore.current;
    if (me) {
      const who = me.kindled ? `${me.kindled.name} (${me.account.username})` : me.account.username;
      place(body(this, 0, 0, displayable(who), Palette.uiInkMuted), UI_W - 6, 36, 1);
    }
    const logout = button(this, 0, 4, 'LOG OUT', false, () => {
      this.logOut();
    });
    logout.container.setX(UI_W - 6 - logout.width);

    // The run's weapon (M2 Task 8): the rack decides. The roster's fallback shows until the holding answers.
    const fallback = startWeapon(null, t);
    this.weaponName = label(this, 0, 0, fallback.name.toUpperCase(), Palette.uiInk);
    this.weaponNote = body(this, 0, 0, '', Palette.uiInkMuted);
    place(this.weaponName, cx, WEAPON_Y + 10, 0.5);
    place(this.weaponNote, cx, WEAPON_Y + 24, 0.5);
    this.setWeapon(fallback);
    void api.holding().then((res) => {
      if (!this.alive) return;
      this.setWeapon(startWeapon(res.ok ? res.value : null, tuningStore.get()));
    });

    // Seed.
    const seedY = WEAPON_Y + WEAPON_H + 10;
    place(label(this, 0, 0, 'SEED', Palette.uiInk), cx - 120, seedY + 4);
    const g = this.add.graphics();
    panel(g, cx - 84, seedY, 128, 16, { plain: true });
    this.field = label(this, cx - 79, seedY + 4, '', Palette.spark);
    this.caret = this.add.rectangle(0, seedY + 4, 1, 8, Palette.spark).setOrigin(0, 0);
    this.tweens.add({ targets: this.caret, alpha: 0, duration: 400, yoyo: true, repeat: -1 });
    button(this, cx + 50, seedY, 'NEW SEED', false, () => {
      this.seedText = String(randomSeed());
    });

    // The main action is the holding (M2 Task 3b); the M1 run stays as a secondary entry, the combat test bed,
    // until boats reach encounters.
    const holding = button(this, 0, seedY + 26, 'HOLDING', true, () => {
      this.startHolding();
    });
    holding.container.setX(Math.round(cx - holding.width / 2));
    this.tweens.add({ targets: holding.container, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
    button(this, Math.round(cx + holding.width / 2) + 10, seedY + 26, 'START RUN', false, () => {
      this.startRun();
    });
    const inventory = button(this, 0, seedY + 26, 'INVENTORY', false, () => {
      this.scene.start('inventory');
    });
    inventory.container.setX(Math.round(cx - holding.width / 2) - 10 - inventory.width);
    const controls = button(this, 0, seedY + 46, 'CONTROLS', false, () => {
      this.scene.start('controls');
    });
    controls.container.setX(Math.round(cx - controls.width / 2));

    // The build, bottom right, in the band between the buttons and the hint panel.
    buildLabel(this, HINT_PANEL_Y - 2);

    // Mood: the Kindled facing a Husk at the shore.
    const mood = this.add.graphics();
    groundShadow(mood, 60, UI_H - 22, 5, 2);
    drawKindled(mood, 60, UI_H - 27, 2);

    // Key hints as controller glyphs, for the active device (keyboard+mouse or the pad preset in
    // the connected pad's family); they switch live with the device.
    this.padFamily = padFamilyNow();
    this.hintPanel = this.add.graphics();
    this.hintRows = [0, 1].map(
      () => new HintRow(this, { tint: Palette.uiInk, wordColor: Palette.uiInkMuted }),
    );
    this.syncHints();
    const offDevice = deviceStore.subscribe(() => {
      this.syncHints();
    });
    const offPreset = controlsStore.subscribe(() => {
      this.syncHints();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offDevice();
      offPreset();
    });

    // Text entry reads DOM key events directly (Phaser's key queue is for game controls).
    const controlsKey = eventKeyFor(keyboardBinding('controls')).toLowerCase();
    const inventoryKey = eventKeyFor(keyboardBinding('inventory')).toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        if (e.shiftKey) this.startRun();
        else this.startHolding();
      }
      else if (e.key === 'Escape') this.logOut();
      else if (e.key.toLowerCase() === controlsKey) this.scene.start('controls');
      else if (e.key.toLowerCase() === inventoryKey) this.scene.start('inventory');
      else if (e.key === 'Backspace') this.seedText = this.seedText.slice(0, -1);
      else if (/^[a-z0-9]$/i.test(e.key) && this.seedText.length < MAX_SEED_LEN)
        this.seedText += e.key.toUpperCase();
    };
    window.addEventListener('keydown', onKey);
    const onPaste = (e: ClipboardEvent) => {
      const text = (e.clipboardData?.getData('text') ?? '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase();
      if (text) this.seedText = text.slice(0, MAX_SEED_LEN);
    };
    window.addEventListener('paste', onPaste);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    });
  }

  /** The hint lines for the active device: its bindings, then the menu keys. */
  private hintLines(): HintItem[][] {
    // On touch the key and pad lines hide: every action here is a button (M2 Task 10).
    if (deviceStore.get() === 'touch') return [[], []];
    if (deviceStore.get() === 'gamepad') {
      const pad = controlsStore.get();
      const padKey = (action: ControlAction): HintItem[] =>
        glyphs(glyphsFor(pad, action), this.padFamily);
      const menu = (index: number): HintItem[] => glyphs([menuGlyph(index)], this.padFamily);
      return [
        [
          word(`${pad.name}:`),
          ...padKey('light'),
          word('light  ·  hold'),
          ...padKey('heavy'),
          word('Hook-thrust  ·'),
          ...padKey('dodge'),
          word('dodge  ·'),
          ...padKey('ability1'),
          word('Haul  ·'),
          ...padKey('item1'),
          ...padKey('item2'),
          word('items  ·'),
          word(pad.aim === 'left-stick' ? 'aim follows movement' : 'right stick aims'),
        ],
        [
          ...menu(MENU_BUTTONS.confirm[0]),
          word('holding  ·'),
          ...MENU_BUTTONS.confirm.slice(1).flatMap((b) => menu(b)),
          word('run  ·'),
          ...menu(MENU_BUTTONS.controls),
          word('controls  ·'),
          ...menu(MENU_BUTTONS.inventory),
          ...padKey('inventory'),
          word('inventory  ·'),
          ...menu(MENU_BUTTONS.back),
          word('log out'),
        ],
      ];
    }
    const key = (action: ControlAction): HintItem[] =>
      glyphs([keyboardBinding(action)], 'keyboard');
    return [
      [
        ...glyphs(['W', 'A', 'S', 'D'], 'keyboard'),
        word('move  ·'),
        ...glyphs(['Mouse'], 'keyboard'),
        word('aim  ·'),
        ...key('light'),
        word('light  ·  hold'),
        ...key('heavy'),
        word('Hook-thrust  ·'),
        ...key('dodge'),
        word('dodge  ·'),
        ...key('ability1'),
        word('Haul  ·'),
        ...key('item1'),
        ...key('item2'),
        word('items'),
      ],
      [
        ...glyphs(['Enter'], 'keyboard'),
        word('holding  ·  Shift+Enter run  ·'),
        ...key('controls'),
        word('controls  ·'),
        ...key('inventory'),
        word('inventory  ·'),
        ...key('tuning'),
        word('tuning  ·'),
        ...key('debug'),
        word('debug  ·'),
        ...glyphs(['Esc'], 'keyboard'),
        word('log out'),
      ],
    ];
  }

  /**
   * Rebuild the hint lines for the device in use, on a plain panel sized to
   * them over the shore strip (the Kindled stands beside it), and set the
   * cursor to match.
   */
  private syncHints(): void {
    const cx = HINT_PANEL_CX;
    this.hintLines().forEach((items, i) => {
      this.hintRows[i]?.setItems(items).place(cx, HINT_PANEL_Y + HINT_PANEL_PAD + i * 14, 0.5);
    });
    const w = Math.max(...this.hintRows.map((r) => r.width)) + 2 * HINT_PANEL_PAD;
    this.hintPanel.clear();
    if (w <= 2 * HINT_PANEL_PAD) {
      menuCursor(this);
      return;
    }
    panel(this.hintPanel, Math.round(cx - w / 2), HINT_PANEL_Y, w, 2 * HINT_PANEL_PAD + 26, {
      plain: true,
    });
    menuCursor(this);
  }

  /** The weapon START RUN takes, and what the screen says about it: its name, and LORE's line when it came from the rack. */
  private setWeapon(w: ReturnType<typeof startWeapon>): void {
    this.weapon = w.weapon;
    this.weaponLine = w.line;
    this.weaponName.setText(w.name.toUpperCase());
    this.weaponNote.setText(w.line ?? '');
    const cx = UI_W / 2;
    place(this.weaponName, cx, WEAPON_Y + 10, 0.5);
    place(this.weaponNote, cx, WEAPON_Y + 24, 0.5);
  }

  /** End the session on the server and go back to the account screen. */
  logOut(): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    void api.logout().then(() => {
      accountStore.current = null;
      this.scene.start('account');
    });
  }

  /** The holding: the Kindled's home Shard (docs/design/holding.md). */
  startHolding(): void {
    this.scene.start('holding');
  }

  startRun(): void {
    const seed = parseSeed(this.seedText || '0');
    const data: GameData = { seed, weapon: this.weapon };
    this.scene.start('game', data);
  }

  override update(): void {
    const family = padFamilyNow();
    if (family !== this.padFamily) {
      this.padFamily = family;
      this.syncHints();
    }
    this.field.setText(this.seedText);
    this.caret.setX(Math.round(this.field.x + this.field.width + 1));
    const edges = padEdges(this.pad);
    if (edges.includes(MENU_BUTTONS.confirm[0])) this.startHolding();
    else if (MENU_BUTTONS.confirm.slice(1).some((b) => edges.includes(b))) this.startRun();
    else if (edges.includes(MENU_BUTTONS.controls)) this.scene.start('controls');
    else if (
      edges.includes(MENU_BUTTONS.inventory) ||
      buttonsFor(controlsStore.get(), 'inventory', 'calm').some((b) => edges.includes(b))
    )
      this.scene.start('inventory');
    else if (edges.includes(MENU_BUTTONS.back)) this.logOut();
  }
}
