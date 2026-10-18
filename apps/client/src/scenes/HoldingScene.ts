import Phaser from 'phaser';
import {
  HOLDING_HEARTBEAT_MS,
  holdingLayout,
  type ClayTone,
  type HoldingResponse,
  type InventoryResponse,
  type LayoutStation,
} from '@iot/shared';
import { Button, TILE_PX } from '@iot/sim';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import { Controls } from '../game/controls.js';
import { controlsStore } from '../game/controlsStore.js';
import { buttonsFor, connectedPad, MENU_BUTTONS, padEdges, padEdgeState } from '../game/gamepad.js';
import {
  chipState,
  clockOffset,
  cyclesDone,
  nearestStationPart,
  packFill,
  purseGin,
  serverTime,
  stationLines,
  takeFloat,
  takeResultLine,
  USE_LABEL,
  type NearStation,
  type StationLines,
} from '../game/holdingView.js';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import { derive, hudName, writChip } from '../game/writView.js';
import { keyboardKeys, keyCodeFor } from '../game/keyboard.js';
import { RoamSession } from '../game/roamSession.js';
import { tuningStore } from '../game/tuningStore.js';
import { fitUi, fitWorldView, viewInUi, type Rect as ViewRect, type UiFit, type WorldFit } from '../game/view.js';
import { Palette } from '../palette.js';
import { button, type Button as MenuButton } from '../render/button.js';
import { clampScroll } from '../render/camera.js';
import { DEPTH } from '../render/depth.js';
import { hintItems, HintRow } from '../render/hint.js';
import { HoldingHud, type WritHud } from '../render/holdingHud.js';
import { loadLetterSheet, type LetterSheet } from '../render/letters.js';
import { uiToCss } from '../render/cameras.js';
import { HoldingWorld } from '../render/holdingWorld.js';
import { menuCursor } from '../render/menus.js';
import { HOLDING_SHEET, preloadTileSheet } from '../render/roomTiles.js';
import { simPx, worldPx } from '../render/scale.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { preloadSpriteSheets, registerSpriteSheets } from '../render/spriteSheets.js';
import { blinkOut, body, label, place, preloadFonts, registerFonts, shadowed, type Shadowed, type Text } from '../render/text.js';
import { divider, panel } from '../render/ui.js';
import { NameScreen } from '../ui/nameScreen.js';
import { WritPanel } from '../ui/writPanel.js';
import type { InventoryData } from './InventoryScene.js';

/** The station panel (UI px): a small panel over the view's centre with the station's lines and two buttons. */
const PANEL_W = 176;
const PANEL_PAD = 8;
/** A "+1" (or a take-all's "+3") floater rises this far over its life, and blinks out over the last 200 ms. */
const FLOAT_MS = 700;
const FLOAT_RISE = 10;
const FLOAT_BLINK_MS = 200;

interface Floater {
  text: Shadowed;
  stationId: string;
  /** Where the Kindled stood when it rose: the floater stays over the station's part nearest there (the trees). */
  near: { x: number; y: number };
  life: number;
}

interface StationPanel {
  station: LayoutStation;
  g: Phaser.GameObjects.Graphics;
  texts: Text[];
  buttons: MenuButton[];
  focus: number;
  result: Text;
  resultAt: number;
  /** The lines shown, from the latest answer (null until the station's data is known). */
  lines: StationLines | null;
}

/**
 * The holding (docs/design/holding.md, M2 Task 3b): the Kindled's home Shard,
 * walked by the roam sim, drawn like a room on the world camera with the
 * station props and the Kindled, the HUD on the UI camera. The active
 * action lives on the server: the scene calls GET /api/holding every 30 s and
 * after each interaction (the heartbeat), and redraws from the answers;
 * nothing of value is decided here. Use on the Writ post opens the Writ panel
 * (the Name screen first, while the island has no Name; M2 Task 4a); Use on
 * the holding store opens the inventory with the store pane; Use on a tree
 * or the outcrop opens the station panel. Stopping is on the chip and in the
 * panel ("Stop working"); there is no stop binding (GAME DESIGN 2026-10-18).
 */
export class HoldingScene extends Phaser.Scene {
  session!: RoamSession;
  controls!: Controls;
  world!: HoldingWorld;
  private hud!: HoldingHud;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private worldFit: WorldFit = { zW: 1, w: 960, h: 540, x: 0, y: 0 };
  private uiFit: UiFit = { zU: 1, w: 480, h: 270 };
  private frame: ViewRect = { x: 0, y: 0, w: 480, h: 270 };
  private fitKey = '';
  private scroll = { x: 0, y: 0 };
  private camX = 0;
  private camY = 0;
  private prompt!: HintRow;
  private pad = { prev: [] as boolean[] };
  /** The left stick's last direction on the Writ panel (−1, 0, 1 per axis), so a push moves the focus once. */
  private stick = { x: 0, y: 0 };
  /** The server's latest answers, and its clock against ours. */
  response: HoldingResponse | null = null;
  inventory: InventoryResponse | null = null;
  private offset = 0;
  /** A request is in flight: no other holding request until it answers. */
  busy = false;
  private panel: StationPanel | null = null;
  /** The Writ panel and the Name screen (M2 Task 4a), one at a time, over the post. */
  private writPanel: WritPanel | null = null;
  private nameScreen: NameScreen | null = null;
  /** The Old Letters sheet's ink, once loaded (the Name screen, the Writ panel and the HUD draw from it). */
  private letterSheet: LetterSheet | null = null;
  private floaters: Floater[] = [];
  /** The cycles the ring had completed when last looked, for the "+1" prediction. */
  private lastCycles = -1;
  private heartbeat: Phaser.Time.TimerEvent | null = null;
  /** The last error a request answered (playtests). */
  lastError = '';
  /** Between create and shutdown: answers that arrive after the scene is gone are dropped. */
  private alive = false;

  constructor() {
    super('holding');
  }

  preload(): void {
    preloadSheets(this);
    preloadSpriteSheets(this);
    preloadTileSheet(this, HOLDING_SHEET);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerSpriteSheets(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    this.pad = padEdgeState();
    this.response = null;
    this.inventory = null;
    this.busy = false;
    this.panel = null;
    this.writPanel = null;
    this.nameScreen = null;
    this.floaters = [];
    this.lastCycles = -1;
    this.lastError = '';
    this.alive = true;
    if (!this.letterSheet)
      void loadLetterSheet().then(
        (sheet) => {
          if (this.alive) this.letterSheet = sheet;
        },
        (err: unknown) => {
          console.warn(err);
        },
      );
    this.controls = new Controls(this, (p) => {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      return { x: simPx(w.x), y: simPx(w.y) };
    });
    const layout = holdingLayout();
    this.session = new RoamSession(this.controls, layout);
    const tone: ClayTone = accountStore.current?.kindled?.clayTone ?? 'clay-grey-ochre';
    this.world = new HoldingWorld(this, this.worldLayer, layout, () => tuningStore.get().anim, tone);
    this.hud = new HoldingHud(
      this,
      this.hudLayer,
      () => {
        this.stop();
      },
      () => {
        this.openInventory();
      },
    );
    this.prompt = new HintRow(this, { backdrop: true }).setVisible(false);
    this.prompt.container.setDepth(DEPTH.prompt);
    this.hudLayer.add(this.prompt.container);

    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.hudLayer);
    this.cameras.main.setOrigin(0, 0);
    this.uiCam.setOrigin(0, 0);
    this.fitKey = '';
    this.fitCameras();
    menuCursor(this);

    // Keys from controls.json: the inventory opens the inventory, the menu key backs out (the panel first);
    // Enter presses the panel's focused button, the arrows and Tab move its focus.
    const kb = this.input.keyboard;
    const bind = (keys: string[], fn: () => void): void => {
      for (const k of keys) {
        const code = keyCodeFor(k);
        if (code !== undefined) kb?.addKey(code, true).on('down', fn);
      }
    };
    bind(keyboardKeys('inventory'), () => {
      if (!this.writPanel) this.openInventory();
    });
    bind(keyboardKeys('menu'), () => {
      this.back();
    });
    kb?.on('keydown-ENTER', () => {
      if (this.writPanel) {
        this.keyNav = true;
        this.writPanel.press();
      } else this.pressFocused();
    });
    for (const key of ['LEFT', 'RIGHT', 'TAB'])
      kb?.on(`keydown-${key}`, () => {
        if (this.writPanel) {
          this.keyNav = true;
          if (key === 'TAB') this.writPanel.moveFocus(1);
          else this.writPanel.moveSide(key === 'LEFT' ? -1 : 1);
        } else this.moveFocus(1);
      });
    for (const key of ['UP', 'DOWN'])
      kb?.on(`keydown-${key}`, () => {
        if (!this.writPanel) return;
        this.keyNav = true;
        this.writPanel.moveFocus(key === 'UP' ? -1 : 1);
      });

    // A tap on the world is Use (interact is E, Cross or a tap); taps on the HUD's zones are theirs.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.wasTouch && over.length === 0) this.use();
    });
    const offDevice = deviceStore.subscribe(() => {
      menuCursor(this);
    });
    this.heartbeat = this.time.addEvent({
      delay: HOLDING_HEARTBEAT_MS,
      loop: true,
      callback: () => {
        this.refresh();
      },
    });
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.pad = padEdgeState();
      this.refresh();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      offDevice();
      this.closeNameScreen();
      this.closeWritPanel();
      this.controls.dispose();
      this.heartbeat?.remove();
      this.heartbeat = null;
    });
    this.refresh();
  }

  /** The cameras on the canvas (every frame; acts on a change): the world view centred at zW, the UI over it at zU. */
  private fitCameras(): boolean {
    const Wd = this.scale.width;
    const Hd = this.scale.height;
    const view = tuningStore.get().view;
    const key = `${Wd}x${Hd}:${view.widthPx},${view.minWidthPx},${view.minHeightPx},${view.maxHeightPx}`;
    if (key === this.fitKey) return false;
    this.fitKey = key;
    const w = fitWorldView(Wd, Hd, view);
    this.worldFit = w;
    this.uiFit = fitUi(Wd, Hd);
    this.frame = viewInUi(w, this.uiFit.zU);
    this.cameras.main.setViewport(w.x, w.y, w.w * w.zW, w.h * w.zW).setZoom(w.zW);
    this.uiCam.setViewport(0, 0, Wd, Hd).setZoom(this.uiFit.zU).setScroll(0, 0);
    this.hud.setFrame(this.frame);
    if (this.panel) this.placePanel(this.panel);
    return true;
  }

  /** A point of the world (sim px) on the UI grid (UI px). */
  toUi(x: number, y: number): { x: number; y: number } {
    const w = this.worldFit;
    const z = this.uiFit.zU;
    return {
      x: (w.x + (worldPx(x) - this.scroll.x) * w.zW) / z,
      y: (w.y + (worldPx(y) - this.scroll.y) * w.zW) / z,
    };
  }

  /** The world view in UI px (playtests). */
  viewFrame(): Readonly<ViewRect> {
    return this.frame;
  }

  /** The server's clock now, from the latest answer's offset. */
  serverNow(): number {
    return serverTime(this.offset, Date.now());
  }

  // --- The server ------------------------------------------------------

  private take(res: Awaited<ReturnType<typeof api.holding>>): boolean {
    if (!res.ok) {
      this.lastError = res.message;
      return false;
    }
    this.response = res.value;
    this.offset = clockOffset(res.value.now, Date.now());
    this.lastCycles = res.value.activity ? cyclesDone(res.value.activity, this.serverNow()) : -1;
    this.lastError = '';
    this.syncPanel();
    this.syncWritPanel();
    return true;
  }

  /** The heartbeat: GET /api/holding (settles) and the inventory (the pack's fill, the purse). */
  refresh(): void {
    void api.holding().then((res) => {
      if (this.alive) this.take(res);
    });
    void api.inventory().then((res) => {
      if (!this.alive || !res.ok) return;
      this.inventory = res.value;
      this.syncWritPanel();
    });
  }

  private request(call: () => ReturnType<typeof api.holding>, then?: () => void): void {
    if (this.busy) return;
    this.busy = true;
    void call().then((res) => {
      if (!this.alive) return;
      this.busy = false;
      if (this.take(res)) then?.();
    });
  }

  /** Work here (or switch here): POST /api/holding/work. */
  work(stationId: string): void {
    this.request(() => api.holdingWork({ stationId }));
  }

  /** Stop the action: the chip, or the panel's STOP WORKING. */
  stop(): void {
    if (!this.response?.activity) return;
    this.request(() => api.holdingStop());
  }

  /**
   * Take all: what fits of the basket into the store. What moved floats over
   * the station as "+3", the float the cycles use; "Store: … full." is the
   * one panel line, when it applies (GAME DESIGN 2026-10-18).
   */
  takeAll(stationId: string): void {
    this.request(
      () => api.holdingTake({ stationId }),
      () => {
        const take = this.response?.take;
        if (take) {
          const text = takeFloat(take);
          if (text) this.float(text, stationId);
          const line = takeResultLine(take);
          if (line && this.panel?.station.id === stationId) {
            this.panel.result.setText(line).setVisible(true);
            this.panel.resultAt = this.time.now;
            this.placePanel(this.panel);
          }
        }
        void api.inventory().then((res) => {
          if (this.alive && res.ok) this.inventory = res.value;
        });
      },
    );
  }

  // --- Interaction -------------------------------------------------------

  /** The station part in reach of the Kindled, if any (the prompt's rules and range; a reserved spot never is). */
  private near(): NearStation | null {
    const p = this.session.position();
    return nearestStationPart(p.x, p.y, tuningStore.get().juice.promptRangePx, this.session.layout);
  }

  /** Use: the post opens the Writ panel (the Name screen first, unnamed); the store opens the inventory with the store pane; a tree or the outcrop opens its panel. */
  private use(): void {
    if (this.nameScreen) return;
    if (this.writPanel) {
      this.closeWritPanel();
      return;
    }
    if (this.panel) {
      this.closePanel();
      return;
    }
    const near = this.near();
    if (!near) return;
    const { station } = near;
    if (station.kind === 'post') this.openWrit();
    else if (station.kind === 'store') this.openInventory();
    else this.openPanel(station);
  }

  // --- The Writ (M2 Task 4a) ----------------------------------------------------

  /** The post's Use: the Name screen while the island has no Name, else the Writ panel. */
  private openWrit(): void {
    if (!this.response) return;
    if (this.response.writ.name === null) this.openNameScreen();
    else this.openWritPanel();
  }

  /** How the UI grid maps to CSS px for the Name screen's DOM input: the UI camera sits at zU over the whole canvas. */
  private cssMap(): { zoom: number; x: number; y: number } {
    return uiToCss(this.game.canvas, { ui: this.uiFit, origin: { x: 0, y: 0 } });
  }

  private openNameScreen(): void {
    this.closePanel();
    this.closeWritPanel();
    if (this.nameScreen) return;
    this.session.held = true;
    // The DOM input has the keyboard: the plugin's captures (WASD, E, I) would swallow the typing, so they
    // stop preventing the default while the screen is open; the scene's handlers ignore Use and the
    // inventory key meanwhile, the roam is held, and Esc still backs out through the menu key.
    const kb = this.input.keyboard;
    if (kb) kb.manager.preventDefault = false;
    this.nameScreen = new NameScreen({
      scene: this,
      layer: this.hudLayer,
      frame: () => this.frame,
      cssMap: () => this.cssMap(),
      sheet: () => this.letterSheet,
      submit: (name) => {
        this.nameIsland(name);
      },
    });
  }

  private closeNameScreen(): void {
    if (!this.nameScreen) return;
    this.nameScreen.destroy();
    this.nameScreen = null;
    const kb = this.input.keyboard;
    if (kb) {
      kb.manager.preventDefault = true;
      // Keys typed into the input were seen going down and up; none stays held.
      kb.resetKeys();
    }
    this.session.held = false;
  }

  /** POST /api/writ/name: the server's answer decides; a refusal shows its message in one line; an accepted Name flares, then the panel opens. */
  private nameIsland(name: string): void {
    if (this.busy) return;
    this.busy = true;
    void api.writName({ name }).then((res) => {
      if (!this.alive) return;
      this.busy = false;
      const screen = this.nameScreen;
      if (!screen) return;
      if (!res.ok) {
        screen.setError(res.message);
        return;
      }
      const letters = this.take(res) ? this.response?.writ.letters : null;
      if (letters) screen.accept(letters);
      else screen.setError('');
    });
  }

  private openWritPanel(): void {
    this.closePanel();
    if (this.writPanel) return;
    this.session.held = true;
    this.writPanel = new WritPanel({
      scene: this,
      layer: this.hudLayer,
      frame: () => this.frame,
      sheet: () => this.letterSheet,
      showFocus: () => this.showFocus(),
      feed: (itemId, count) => {
        this.feedWrit({ itemId, count });
      },
      fill: () => {
        this.feedWrit({ fill: true });
      },
    });
    this.syncWritPanel();
    // Opening the panel is an interaction: the Writ and the Sparkglass it shows are fresh.
    this.refresh();
  }

  private closeWritPanel(): void {
    if (!this.writPanel) return;
    this.writPanel.destroy();
    this.writPanel = null;
    this.session.held = false;
  }

  /** The panel's lines from the latest answers (the holding and the inventory). */
  private syncWritPanel(): void {
    if (this.writPanel && this.response) this.writPanel.sync(this.response.writ, this.inventory, this.serverNow());
  }

  /** POST /api/writ/feed: the face relights from the answer, never ahead of it; a refusal is the panel's one line. */
  private feedWrit(body: Parameters<typeof api.writFeed>[0]): void {
    if (this.busy) return;
    this.busy = true;
    void api.writFeed(body).then((res) => {
      if (!this.alive) return;
      this.busy = false;
      if (!res.ok) {
        this.writPanel?.setResult(res.message);
        return;
      }
      if (!this.take(res)) return;
      void api.inventory().then((inv) => {
        if (this.alive && inv.ok) {
          this.inventory = inv.value;
          this.syncWritPanel();
        }
      });
      this.afterFeeding();
    });
  }

  /**
   * The seams for 4b (Kesh, LORE's lines after naming and feeding, the tide):
   * called once the server has accepted a Name, and once a feed has landed.
   */
  private afterNaming(): void {
    // 4b: Kesh's line across the water, the Narrator, the hint.
  }

  private afterFeeding(): void {
    // 4b: the once-per-tide sliver, the tide clock.
  }

  /** The Writ block of the HUD: the Name and the chip, re-derived at the server's clock between heartbeats. */
  private writHud(): WritHud | null {
    const view = this.response?.writ;
    if (!view) return null;
    return { name: hudName(view), chip: writChip(derive(view, this.serverNow())) };
  }

  openInventory(): void {
    if (this.nameScreen) return;
    if (this.panel) this.closePanel();
    if (this.writPanel) this.closeWritPanel();
    const data: InventoryData = { back: 'holding' };
    this.scene.launch('inventory', data);
    this.scene.pause();
  }

  /** Esc / Circle: close the Name screen or a panel, else back to the start screen. */
  private back(): void {
    if (this.nameScreen) {
      this.closeNameScreen();
      return;
    }
    if (this.writPanel) {
      this.closeWritPanel();
      return;
    }
    if (this.panel) {
      this.closePanel();
      return;
    }
    this.scene.start('start');
  }

  private openPanel(station: LayoutStation): void {
    this.closePanel();
    this.closeWritPanel();
    const g = this.add.graphics();
    const texts = [
      label(this, 0, 0, '', Palette.uiInk),
      body(this, 0, 0, '', Palette.uiInk),
      body(this, 0, 0, '', Palette.uiInk),
      body(this, 0, 0, '', Palette.spark),
      body(this, 0, 0, '', Palette.uiInkMuted),
    ];
    const result = body(this, 0, 0, '', Palette.uiInk).setVisible(false);
    const buttons = [
      button(this, 0, 0, 'WORK HERE', true, () => {
        if (this.panel?.lines?.working) this.stop();
        else this.work(station.id);
      }),
      button(this, 0, 0, 'TAKE ALL', false, () => {
        this.takeAll(station.id);
      }),
    ];
    const p: StationPanel = { station, g, texts, buttons, focus: 0, result, resultAt: -1, lines: null };
    this.hudLayer.add([g, ...texts, result, ...buttons.map((b) => b.container)]);
    for (const o of [g, ...texts, result, ...buttons.map((b) => b.container)]) o.setDepth(DEPTH.prompt);
    this.panel = p;
    this.session.held = true;
    this.syncPanel();
    // Opening the panel is an interaction: the counts it shows are settled fresh.
    this.refresh();
  }

  private closePanel(): void {
    const p = this.panel;
    if (!p) return;
    p.g.destroy();
    for (const t of p.texts) t.destroy();
    p.result.destroy();
    for (const b of p.buttons) b.container.destroy(true);
    this.panel = null;
    this.session.held = false;
  }

  /** The panel's lines from the latest answer; its first button reads WORK HERE or STOP WORKING. */
  private syncPanel(): void {
    const p = this.panel;
    if (!p) return;
    const lines = stationLines(p.station.id, this.response);
    p.lines = lines;
    if (!lines) return;
    p.texts[0]?.setText(lines.title);
    p.texts[1]?.setText(lines.rate);
    p.texts[2]?.setText(lines.basket);
    p.texts[3]?.setText(lines.you ?? '').setVisible(lines.you !== null);
    p.texts[4]?.setText(lines.skill);
    // The first button's word changes with the state: rebuild it in place.
    const first = p.buttons[0];
    if (first) {
      const want = lines.work;
      const have = first.container.list.find((o): o is Text => 'text' in o && typeof (o as Text).text === 'string');
      if (have?.text !== want) {
        first.container.destroy(true);
        const replaced = button(this, 0, 0, want, true, () => {
          if (this.panel?.lines?.working) this.stop();
          else this.work(p.station.id);
        });
        replaced.container.setDepth(DEPTH.prompt);
        this.hudLayer.add(replaced.container);
        p.buttons[0] = replaced;
      }
    }
    this.placePanel(p);
  }

  /** Lays the panel out over the view's centre: the lines, a divider, the buttons, the result line. */
  private placePanel(p: StationPanel): void {
    const x = Math.round(this.frame.x + this.frame.w / 2 - PANEL_W / 2);
    const inner = PANEL_W - 2 * PANEL_PAD;
    const rows = p.texts.filter((t) => t.visible);
    const h = PANEL_PAD + 10 + 2 + rows.length * 11 - 11 + 11 + 6 + 1 + 6 + 15 + 4 + 11 + PANEL_PAD;
    const y = Math.round(this.frame.y + this.frame.h / 2 - h / 2);
    p.g.clear();
    panel(p.g, x, y, PANEL_W, h);
    let ly = y + PANEL_PAD;
    place(p.texts[0] ?? rows[0] ?? p.result, x + PANEL_PAD, ly);
    ly += 12;
    for (const t of p.texts.slice(1)) {
      if (!t.visible) continue;
      place(t, x + PANEL_PAD, ly);
      ly += 11;
    }
    ly += 6;
    divider(p.g, x + PANEL_PAD, ly, inner);
    ly += 1 + 6;
    let bx = x + PANEL_PAD;
    p.buttons.forEach((b, i) => {
      b.container.setPosition(bx, ly);
      b.setFocused(this.showFocus() && i === p.focus);
      bx += b.width + 8;
    });
    ly += 15 + 4;
    place(p.result, x + PANEL_W - PANEL_PAD, ly, 1);
  }

  /** The panel's focus ring shows on the pad, or once the keys moved it. */
  private keyNav = false;
  private showFocus(): boolean {
    return deviceStore.get() === 'gamepad' || this.keyNav;
  }

  private moveFocus(delta: number): void {
    const p = this.panel;
    if (!p) return;
    this.keyNav = true;
    p.focus = (((p.focus + delta) % p.buttons.length) + p.buttons.length) % p.buttons.length;
    this.placePanel(p);
  }

  private pressFocused(): void {
    const p = this.panel;
    if (!p) return;
    const b = p.buttons[p.focus];
    if (!b) return;
    // The zone's handler is the button's own: emit the press it listens for.
    const zone = b.container.list.find((o): o is Phaser.GameObjects.Zone => o instanceof Phaser.GameObjects.Zone);
    zone?.emit('pointerdown');
  }

  // --- The frame ------------------------------------------------------------

  private followCamera(snap: boolean): void {
    const j = tuningStore.get().juice;
    const view = this.worldFit;
    const p = this.session.position();
    const s = this.session.state;
    const tx = worldPx(p.x) - view.w / 2;
    const ty = worldPx(p.y) - view.h / 2;
    const roomW = worldPx(s.room.cols * TILE_PX);
    const roomH = worldPx(s.room.rows * TILE_PX);
    const cx = clampScroll(tx, roomW, view.w, 0, 0);
    const cy = clampScroll(ty, roomH, view.h, 0, 0);
    const k = snap ? 1 : j.cameraLerp;
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.scroll = { x: Math.round(this.camX), y: Math.round(this.camY) };
    this.cameras.main.setScroll(this.scroll.x, this.scroll.y);
  }

  private updatePrompt(): void {
    const near = this.panel || this.writPanel || this.nameScreen ? null : this.near();
    if (!near) {
      this.prompt.setVisible(false);
      return;
    }
    const top = this.world.propTop(near.station.id, this.session.position());
    const at = top ? { x: simPx(top.x), y: simPx(top.y) } : { x: 0, y: 0 };
    const ui = this.toUi(at.x, at.y);
    this.prompt
      .setItems([...hintItems(this.controls.hint('interact')), { text: USE_LABEL }])
      .place(ui.x, ui.y, 0.5, 1)
      .setVisible(true);
  }

  /** A float over a station: "+1" as a cycle completes, "+3" as a take-all moves a basket; over the part nearest the Kindled. */
  private float(text: string, stationId: string): void {
    const t = shadowed(label(this, 0, 0, text, Palette.spark));
    t.setDepth(DEPTH.floaters);
    this.hudLayer.add(t);
    this.floaters.push({ text: t, stationId, near: this.session.position(), life: FLOAT_MS });
  }

  /** A "+1" over the station as each cycle completes: predicted from the ring, render only; the counts come from the server. */
  private updateFloaters(delta: number): void {
    const activity = this.response?.activity;
    if (activity) {
      const done = cyclesDone(activity, this.serverNow());
      if (this.lastCycles >= 0 && done > this.lastCycles) this.float('+1', activity.stationId);
      this.lastCycles = done;
    }
    this.floaters = this.floaters.filter((f) => {
      f.life -= delta;
      if (f.life <= 0) {
        f.text.destroy(true);
        return false;
      }
      const top = this.world.propTop(f.stationId, f.near);
      if (top) {
        const rise = FLOAT_RISE * (1 - f.life / FLOAT_MS);
        const ui = this.toUi(simPx(top.x), simPx(top.y));
        place(f.text, ui.x, ui.y - 4 - rise, 0.5, 1);
      }
      blinkOut(f.text, f.life, FLOAT_BLINK_MS);
      return true;
    });
  }

  private updatePanelResult(): void {
    const p = this.panel;
    if (!p || p.resultAt < 0) return;
    const elapsed = this.time.now - p.resultAt;
    if (elapsed >= REFUSAL_LIFE_MS) {
      p.result.setVisible(false);
      p.resultAt = -1;
    } else p.result.setVisible(refusalVisible(elapsed));
  }

  /** What the playtests read: the roam state, the pose, the server's answers and the panel. */
  snapshot(): {
    state: ReturnType<RoamSession['position']> & { gait: string; facing: number; tick: number };
    pose: string;
    response: HoldingResponse | null;
    panel: string | null;
    result: string;
    /** The floaters alive this frame ("+1", "+3"). */
    floats: string[];
    prompt: boolean;
    chip: ReturnType<typeof chipState>;
    /** Every prop's sheet, frame and depth, and the Kindled's depth, for the draw-order checks. */
    props: ReturnType<HoldingWorld['propFrames']>;
    playerDepth: number;
    /** The Writ (M2 Task 4a): the HUD's block, the panel and the Name screen while open. */
    writ: WritHud | null;
    writPanel: ReturnType<WritPanel['snapshot']> | null;
    nameScreen: ReturnType<NameScreen['snapshot']> | null;
    writTip: boolean;
    /** The HUD's Writ block (UI px), for the tooltip hover. */
    writRect: ViewRect;
    lettersLoaded: boolean;
  } {
    const s = this.session.state;
    return {
      state: { ...this.session.position(), gait: s.gait, facing: s.facing, tick: s.tick },
      pose: this.world.pose ? `${this.world.pose.name}/${this.world.pose.frame}` : '',
      response: this.response,
      panel: this.panel?.station.id ?? null,
      result: this.panel?.result.visible ? this.panel.result.text : '',
      floats: this.floaters.map((f) => f.text.text),
      prompt: this.prompt.container.visible,
      chip: chipState(this.response, this.serverNow()),
      props: this.world.propFrames(),
      playerDepth: this.world.playerDepth(),
      writ: this.writHud(),
      writPanel: this.writPanel?.snapshot() ?? null,
      nameScreen: this.nameScreen?.snapshot() ?? null,
      writTip: this.hud.writTipVisible,
      writRect: this.hud.writRect,
      lettersLoaded: this.letterSheet !== null,
    };
  }

  override update(_time: number, delta: number): void {
    const refit = this.fitCameras();
    this.session.update(delta);
    if (this.session.pressed & Button.Interact) this.use();
    this.followCamera(refit || this.session.state.tick <= 1);
    this.world.draw(this.session.state, this.session.position());
    this.hud.draw(chipState(this.response, this.serverNow()), packFill(this.inventory), purseGin(this.inventory), this.writHud(), this.letterSheet);
    this.updatePrompt();
    this.updateFloaters(delta);
    this.updatePanelResult();
    if (this.nameScreen) {
      this.nameScreen.update(this.game.canvas);
      if (this.nameScreen.done) {
        this.closeNameScreen();
        this.afterNaming();
        this.openWritPanel();
      }
    }
    this.writPanel?.update(this.serverNow());

    // The pad: Circle backs out, the D-pad moves the panel's focus, Cross presses it (Cross is also interact in
    // Calm, which `use` handles through the roam's input while no panel is open). No stop binding: the chip and the panel.
    const edges = padEdges(this.pad);
    const preset = controlsStore.get();
    if (edges.includes(MENU_BUTTONS.back)) this.back();
    else if (this.writPanel) {
      const p = this.writPanel;
      // The left stick moves the focus like the D-pad: once per push past the deadzone.
      const axes = connectedPad()?.axes ?? [];
      const sx = Math.abs(axes[0] ?? 0) > 0.5 ? Math.sign(axes[0] ?? 0) : 0;
      const sy = Math.abs(axes[1] ?? 0) > 0.5 ? Math.sign(axes[1] ?? 0) : 0;
      const pushedX = sx !== 0 && sx !== this.stick.x ? sx : 0;
      const pushedY = sy !== 0 && sy !== this.stick.y ? sy : 0;
      this.stick = { x: sx, y: sy };
      if (edges.includes(MENU_BUTTONS.up) || pushedY < 0) p.moveFocus(-1);
      else if (edges.includes(MENU_BUTTONS.down) || pushedY > 0) p.moveFocus(1);
      else if (edges.includes(MENU_BUTTONS.left) || pushedX < 0) p.moveSide(-1);
      else if (edges.includes(MENU_BUTTONS.right) || pushedX > 0) p.moveSide(1);
      else if (edges.includes(MENU_BUTTONS.confirm[0]) && !buttonsFor(preset, 'interact', 'calm').includes(MENU_BUTTONS.confirm[0])) p.press();
      else if (MENU_BUTTONS.confirm.slice(1).some((b) => edges.includes(b))) p.press();
    } else if (this.panel) {
      if ([MENU_BUTTONS.left, MENU_BUTTONS.right, MENU_BUTTONS.up, MENU_BUTTONS.down].some((b) => edges.includes(b))) this.moveFocus(1);
      else if (edges.includes(MENU_BUTTONS.confirm[0]) && !buttonsFor(preset, 'interact', 'calm').includes(MENU_BUTTONS.confirm[0])) this.pressFocused();
      else if (MENU_BUTTONS.confirm.slice(1).some((b) => edges.includes(b))) this.pressFocused();
    }
  }
}
