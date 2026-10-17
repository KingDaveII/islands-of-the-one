import Phaser from 'phaser';
import type { ControlAction } from '@iot/shared';
import { isWeaponAvailable, type Tuning } from '@iot/sim';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { controlsStore } from '../game/controlsStore.js';
import { buttonsFor, glyphsFor, MENU_BUTTONS, padEdges, padEdgeState, type PadFamily } from '../game/gamepad.js';
import { eventKeyFor, keyboardBinding } from '../game/keyboard.js';
import { parseSeed, randomSeed } from '../game/seed.js';
import { displayable } from '../game/drawable.js';
import { tuningStore } from '../game/tuningStore.js';
import { Palette } from '../palette.js';
import { glyphs, HintRow, word, type HintItem } from '../render/hint.js';
import { button } from '../render/button.js';
import { menuCursor, menuGlyph, padFamilyNow } from '../render/menus.js';
import { groundShadow } from '../render/pixels.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { body, label, place, preloadFonts, registerFonts, type Text } from '../render/text.js';
import { abilitySlot, divider, panel, tierPips } from '../render/ui.js';
import { drawKindled } from '../render/world.js';
import { buildLabel } from '../ui/buildLabel.js';
import type { GameData } from './GameScene.js';
import { UI_H, UI_W } from '../game/view.js';
import { menuCamera } from '../render/cameras.js';

const MAX_SEED_LEN = 16;
const CARD_W = 136;
const CARD_H = 104;
const CARD_GAP = 8;
const CARD_Y = 62;
/** The hint panel over the shore strip: centered right of the Kindled, two 12 px rows on a 14 px pitch. */
const HINT_PANEL_CX = 282;
const HINT_PANEL_Y = UI_H - 40;
const HINT_PANEL_PAD = 6;

/**
 * Start screen: pick the run's weapon (one per run; only the Hookblade is
 * available yet, the rest show as locked), keep or type a seed, start. The
 * signed-in Kindled shows top right, with the log-out button (Esc, Circle).
 */
export class StartScene extends Phaser.Scene {
  seedText = '';
  weapon = 'hookblade';
  private field!: Text;
  private caret!: Phaser.GameObjects.Rectangle;
  private cards!: Phaser.GameObjects.Graphics;
  private pad = { prev: [] as boolean[] };
  /** The two hint lines (the active device's bindings, then the menu keys) and the pad family they are drawn in. */
  private hintRows: HintRow[] = [];
  /** The plain panel behind the hint lines (the ink needs ui-panel under it, not the pale floor). */
  private hintPanel!: Phaser.GameObjects.Graphics;
  private padFamily: PadFamily = 'ps';
  /** Divider y per card (between stats and lore). */
  private dividers: number[] = [];
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
    const t: Tuning = tuningStore.get();
    const roster = t.weaponRoster;
    this.weapon = roster.find((w) => isWeaponAvailable(t, w.id))?.id ?? 'hookblade';
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
    place(label(this, 0, 0, 'CHOOSE YOUR WEAPON', Palette.uiInk), cx, 50, 0.5);

    // Weapon cards.
    this.cards = this.add.graphics();
    const x0 = Math.round(cx - (roster.length * CARD_W + (roster.length - 1) * CARD_GAP) / 2);
    roster.forEach((entry, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      const weapon = t.weapons[entry.id];
      const available = isWeaponAvailable(t, entry.id);
      if (available && weapon) {
        place(label(this, 0, 0, weapon.name.toUpperCase()), x + 32, CARD_Y + 9);
        // Stats first; lore last, muted, below a divider (never italic).
        const stats = body(this, x + 10, CARD_Y + 32, weapon.blurb, Palette.uiInk, CARD_W - 20);
        this.dividers[i] = Math.round(stats.y + stats.height + 3);
        body(
          this,
          x + 10,
          (this.dividers[i] ?? 0) + 4,
          weapon.lore,
          Palette.uiInkMuted,
          CARD_W - 20,
        );
      } else {
        place(label(this, 0, 0, entry.name, Palette.uiInkMuted), x + 32, CARD_Y + 9);
        body(this, x + 10, CARD_Y + 33, 'Not found yet.', Palette.uiInkMuted, CARD_W - 20);
      }
      const zone = this.add
        .zone(x, CARD_Y, CARD_W, CARD_H)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: available });
      zone.on('pointerdown', () => {
        if (available) this.weapon = entry.id;
      });
    });

    // Seed.
    const seedY = CARD_Y + CARD_H + 10;
    place(label(this, 0, 0, 'SEED', Palette.uiInk), cx - 120, seedY + 4);
    const g = this.add.graphics();
    panel(g, cx - 84, seedY, 128, 16, { plain: true });
    this.field = label(this, cx - 79, seedY + 4, '', Palette.spark);
    this.caret = this.add.rectangle(0, seedY + 4, 1, 8, Palette.spark).setOrigin(0, 0);
    this.tweens.add({ targets: this.caret, alpha: 0, duration: 400, yoyo: true, repeat: -1 });
    button(this, cx + 50, seedY, 'NEW SEED', false, () => {
      this.seedText = String(randomSeed());
    });

    const start = button(this, cx - 40, seedY + 26, 'START RUN', true, () => {
      this.startRun();
    });
    this.tweens.add({ targets: start.container, alpha: 0.75, duration: 700, yoyo: true, repeat: -1 });
    button(this, cx + 50, seedY + 26, 'CONTROLS', false, () => {
      this.scene.start('controls');
    });
    const inventory = button(this, 0, seedY + 26, 'INVENTORY', false, () => {
      this.scene.start('inventory');
    });
    inventory.container.setX(cx - 50 - inventory.width);

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
      if (e.key === 'Enter') this.startRun();
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
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    });
  }

  /** The hint lines for the active device: its bindings, then the menu keys. */
  private hintLines(): HintItem[][] {
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
          word('start  ·'),
          ...menu(MENU_BUTTONS.controls),
          word('controls  ·'),
          ...menu(MENU_BUTTONS.inventory),
          ...padKey('inventory'),
          word('inventory  ·'),
          ...menu(MENU_BUTTONS.left),
          ...menu(MENU_BUTTONS.right),
          word('weapon  ·'),
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
        word('start  ·'),
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
    panel(this.hintPanel, Math.round(cx - w / 2), HINT_PANEL_Y, w, 2 * HINT_PANEL_PAD + 26, {
      plain: true,
    });
    menuCursor(this);
  }

  /** Step the weapon choice through the roster's unlocked entries (D-pad). */
  private cycleWeapon(delta: number): void {
    const t: Tuning = tuningStore.get();
    const open = t.weaponRoster.filter((w) => isWeaponAvailable(t, w.id)).map((w) => w.id);
    if (open.length === 0) return;
    const i = Math.max(0, open.indexOf(this.weapon));
    this.weapon = open[(((i + delta) % open.length) + open.length) % open.length] ?? this.weapon;
  }

  private drawCards(): void {
    const t: Tuning = tuningStore.get();
    const roster = t.weaponRoster;
    const g = this.cards;
    g.clear();
    const x0 = Math.round(
      UI_W / 2 - (roster.length * CARD_W + (roster.length - 1) * CARD_GAP) / 2,
    );
    roster.forEach((entry, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      const weapon = t.weapons[entry.id];
      const available = isWeaponAvailable(t, entry.id) && weapon !== undefined;
      const selected = available && entry.id === this.weapon;
      panel(
        g,
        x,
        CARD_Y,
        CARD_W,
        CARD_H,
        selected ? {} : { rim: Palette.uiBevel, plain: !available },
      );
      abilitySlot(g, x + 8, CARD_Y + 7, {
        icon: 'hookblade',
        cooldown: 0,
        locked: !available,
        ready: selected,
      });
      if (available) {
        tierPips(g, x + 32, CARD_Y + 21, weapon.tier);
        divider(g, x + 10, this.dividers[i] ?? CARD_Y + 63, CARD_W - 20);
      }
    });
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

  startRun(): void {
    const seed = parseSeed(this.seedText || '0');
    const data: GameData = { seed, weapon: this.weapon };
    this.scene.start('game', data);
  }

  override update(): void {
    this.drawCards();
    const family = padFamilyNow();
    if (family !== this.padFamily) {
      this.padFamily = family;
      this.syncHints();
    }
    this.field.setText(this.seedText);
    this.caret.setX(Math.round(this.field.x + this.field.width + 1));
    const edges = padEdges(this.pad);
    if (MENU_BUTTONS.confirm.some((b) => edges.includes(b))) this.startRun();
    else if (edges.includes(MENU_BUTTONS.controls)) this.scene.start('controls');
    else if (
      edges.includes(MENU_BUTTONS.inventory) ||
      buttonsFor(controlsStore.get(), 'inventory', 'calm').some((b) => edges.includes(b))
    )
      this.scene.start('inventory');
    else if (edges.includes(MENU_BUTTONS.back)) this.logOut();
    else if (edges.includes(MENU_BUTTONS.left)) this.cycleWeapon(-1);
    else if (edges.includes(MENU_BUTTONS.right)) this.cycleWeapon(1);
  }
}
