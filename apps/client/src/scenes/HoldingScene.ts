import Phaser from 'phaser';
import {
  HOLDING_CAMERA_MARGIN_TILES,
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
  nearKesh,
  packFill,
  purseGin,
  serverTime,
  stationLines,
  takeFloat,
  takeResultLine,
  USE_LABEL,
  type NearStation,
  type StationLines,
  type UiRect,
} from '../game/holdingView.js';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import { KeshTalk, keshSpeaking, TALK_LABEL, type TalkContext, type TalkFlow } from '../game/keshTalk.js';
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
import { TalkBox } from '../ui/talkBox.js';
import { WritPanel } from '../ui/writPanel.js';
import type { InventoryData } from './InventoryScene.js';

/** The station panel (UI px): a small panel over the view's centre with the station's lines and two buttons. */
const PANEL_W = 176;
const PANEL_PAD = 8;
/** A "+1" (or a take-all's "+3") floater rises this far over its life, and blinks out over the last 200 ms. */
const FLOAT_MS = 700;
const FLOAT_RISE = 10;
const FLOAT_BLINK_MS = 200;
/** How far over the Kindled's position (world px) a float over them starts: clear of the head. */
const FLOAT_OVER_KINDLED = 40;

interface Floater {
  text: Shadowed;
  /** Where it floats (sim px) each frame: over a station's part, or where Kesh's sliver landed. */
  at: () => { x: number; y: number } | null;
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
 * Across the water from Kesh (M2 Task 4b) the prompt reads TALK and Use
 * opens the talk box (ui/talkBox.ts, its flow in game/keshTalk.ts); his
 * lines also play after the island is named and after the first feeding,
 * and a line that tosses asks the server for the sliver (the count comes
 * from its answer; the flight is cosmetic).
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
  /** The talk box (M2 Task 4b): Kesh's lines, one at a time, and the menu of topics. */
  private readonly talk = new KeshTalk();
  private talkBox: TalkBox | null = null;
  /** What follows once the box closes (the Writ panel after the naming lines). */
  private afterTalk: (() => void) | null = null;
  /** The step whose toss was asked of the server, so a line asks once. */
  private tossAsked: unknown = null;
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
    this.talkBox = null;
    this.afterTalk = null;
    this.tossAsked = null;
    this.talk.close();
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
    this.world = new HoldingWorld(this, this.worldLayer, layout, () => tuningStore.get().anim, tone, () => tuningStore.get().kesh);
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
      if (this.talkBox) {
        this.keyNav = true;
        this.talkAdvance();
      } else if (this.writPanel) {
        this.keyNav = true;
        this.writPanel.press();
      } else this.pressFocused();
    });
    for (const key of ['LEFT', 'RIGHT', 'TAB'])
      kb?.on(`keydown-${key}`, () => {
        if (this.talkBox) {
          this.keyNav = true;
          if (key === 'TAB') this.talk.moveFocus(1);
          this.syncTalk();
        } else if (this.writPanel) {
          this.keyNav = true;
          if (key === 'TAB') this.writPanel.moveFocus(1);
          else this.writPanel.moveSide(key === 'LEFT' ? -1 : 1);
        } else this.moveFocus(1);
      });
    for (const key of ['UP', 'DOWN'])
      kb?.on(`keydown-${key}`, () => {
        if (this.talkBox) {
          this.keyNav = true;
          this.talk.moveFocus(key === 'UP' ? -1 : 1);
          this.syncTalk();
          return;
        }
        if (!this.writPanel) return;
        this.keyNav = true;
        this.writPanel.moveFocus(key === 'UP' ? -1 : 1);
      });

    // A tap on the world is Use (interact is E, Cross or a tap); taps on the HUD's zones are theirs. While the
    // talk box shows a line, a click or tap anywhere advances it (the menu's rows take their own presses).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.talkBox) {
        if (over.length === 0 && this.talk.step.kind === 'line') this.talkAdvance();
        return;
      }
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
      this.closeTalk();
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

  /**
   * The bodies a HUD panel must not hide (readability.md "The HUD never hides
   * the room", ART on #95): the Kindled (the run's box round its feet) and
   * Kesh while he can be talked to (his drawn pixels); props never count, his
   * rock included. On the UI grid, rounded outwards.
   */
  private bodyRects(): UiRect[] {
    const p = this.session.position();
    const a = this.toUi(Math.round(p.x) - 8, Math.round(p.y) - 14);
    const b = this.toUi(Math.round(p.x) + 8, Math.round(p.y) + 10);
    const rects: UiRect[] = [outward(a, b)];
    const k = this.world.keshBox();
    if (k) rects.push(outward(this.worldToUi(k.x, k.y), this.worldToUi(k.x + k.w, k.y + k.h)));
    return rects;
  }

  /** A point of the world in world px on the UI grid (UI px). */
  private worldToUi(x: number, y: number): { x: number; y: number } {
    const w = this.worldFit;
    const z = this.uiFit.zU;
    return { x: (w.x + (x - this.scroll.x) * w.zW) / z, y: (w.y + (y - this.scroll.y) * w.zW) / z };
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

  /**
   * Use: the post opens the Writ panel (the Name screen first, unnamed); the store opens the inventory with the
   * store pane; a tree or the outcrop opens its panel; the Talk spot across the water from Kesh opens the talk box,
   * and while it is open Use advances it.
   */
  private use(): void {
    if (this.nameScreen) return;
    if (this.talkBox) {
      this.talkAdvance();
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
    const p = this.session.position();
    if (nearKesh(p.x, p.y, tuningStore.get().juice.promptRangePx, this.session.layout)) {
      this.openTalk('talk');
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
    const fedBefore = this.response?.writ.fedAt ?? null;
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
      this.afterFeeding(fedBefore);
    });
  }

  /**
   * Once the server has accepted a Name, after 4a's flare: Kesh's line across
   * the water, the Narrator, the hint (LORE), then the Writ panel opens.
   */
  private afterNaming(): void {
    this.openTalk('afterNaming', () => {
      this.openWritPanel();
    });
  }

  /** Once a feed has landed: the first time (`writ.fedAt` went from null to set), Kesh's line (LORE). */
  private afterFeeding(fedBefore: string | null): void {
    if (fedBefore === null && this.response?.writ.fedAt !== null) this.openTalk('afterFirstFeeding');
  }

  // --- Kesh (M2 Task 4b) ----------------------------------------------------

  /** What the server last said about Kesh, as the flow reads it. */
  private talkContext(): TalkContext {
    const kesh = this.response?.kesh;
    return { firstGiven: kesh?.firstGiven ?? true, due: kesh?.due ?? null };
  }

  /** Opens the talk box on a flow; the Kindled stands still while it is open, the world keeps running. */
  private openTalk(flow: TalkFlow, after?: () => void): void {
    this.closePanel();
    if (this.talkBox) this.closeTalk();
    this.afterTalk = after ?? null;
    this.session.held = true;
    this.talkBox = new TalkBox(
      {
        scene: this,
        layer: this.hudLayer,
        frame: () => this.frame,
        showFocus: () => this.showFocus(),
        hint: () => hintItems(this.controls.hint('interact')),
        choose: (i) => {
          this.talk.setFocus(i);
          this.talkAdvance();
        },
        hover: (i) => {
          this.talk.setFocus(i);
          this.syncTalk();
        },
      },
      this.talk.topics,
    );
    this.talk.start(flow, this.talkContext());
    this.syncTalk();
  }

  /** Confirm: the next line, the menu, or the end; from the menu, the focused topic. */
  private talkAdvance(): void {
    if (!this.talkBox) return;
    // A toss in flight holds the line until the server has answered, so the count never runs ahead of it.
    if (this.talk.step.kind === 'line' && this.talk.step.line.toss !== undefined && this.busy) return;
    this.talk.advance(this.talkContext());
    this.syncTalk();
  }

  /** The box shows the step; a toss line asks the server once and plays Kesh's throw; Kesh talks while his line is open. */
  private syncTalk(): void {
    const box = this.talkBox;
    if (!box) return;
    const step = this.talk.step;
    if (step.kind === 'closed') {
      this.closeTalk();
      return;
    }
    box.show(step);
    if (step.kind === 'line' && step.line.toss !== undefined && this.tossAsked !== step) {
      this.tossAsked = step;
      this.askSliver();
    }
  }

  /**
   * The toss: Kesh's `toss` plays at once and POST /api/kesh/sliver is sent; the sliver leaves his hand on the
   * release frame once the server has given it, flies to the Kindled's feet and lands with a "+1" (render only:
   * the pack's count comes from the answer). A refusal ("Pack full.") is the box's note, and nothing flies.
   */
  private askSliver(): void {
    if (this.busy) return;
    this.busy = true;
    let given = false;
    let released = false;
    const launch = (): void => {
      if (!given || !released || !this.alive) return;
      const feet = this.session.position();
      this.world.launchToss(feet, () => {
        this.float('+1', () => feet);
      });
    };
    this.world.toss(() => {
      released = true;
      launch();
    });
    void api.keshSliver().then((res) => {
      if (!this.alive) return;
      this.busy = false;
      if (!res.ok) {
        this.talkBox?.setNote(res.message);
        return;
      }
      if (!this.take(res)) return;
      given = true;
      launch();
      void api.inventory().then((inv) => {
        if (this.alive && inv.ok) this.inventory = inv.value;
      });
    });
  }

  private closeTalk(): void {
    if (!this.talkBox) return;
    this.talkBox.destroy();
    this.talkBox = null;
    this.talk.close();
    this.tossAsked = null;
    this.session.held = this.panel !== null || this.writPanel !== null || this.nameScreen !== null;
    const after = this.afterTalk;
    this.afterTalk = null;
    after?.();
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

  /** Esc / Circle: close the Name screen, the talk box or a panel, else back to the start screen. */
  private back(): void {
    if (this.nameScreen) {
      this.closeNameScreen();
      return;
    }
    if (this.talkBox) {
      this.closeTalk();
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
    // The camera may scroll `cameraMarginTiles` into the void past every edge, so the HUD's corner panels never
    // cover the shore or Kesh's rock (M2 Task 4b; the margin is data, holding.json).
    const margin = worldPx(HOLDING_CAMERA_MARGIN_TILES * TILE_PX);
    const cx = clampScroll(tx, roomW, view.w, margin, margin);
    const cy = clampScroll(ty, roomH, view.h, margin, margin);
    const k = snap ? 1 : j.cameraLerp;
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.scroll = { x: Math.round(this.camX), y: Math.round(this.camY) };
    this.cameras.main.setScroll(this.scroll.x, this.scroll.y);
  }

  /** The prompt's verb this frame: TALK across the water from Kesh, USE over a station, or nothing (playtests). */
  promptLabel = '';

  private updatePrompt(): void {
    const open = this.panel !== null || this.writPanel !== null || this.nameScreen !== null || this.talkBox !== null;
    const p = this.session.position();
    const talk = !open && nearKesh(p.x, p.y, tuningStore.get().juice.promptRangePx, this.session.layout);
    const near = open || talk ? null : this.near();
    if (!near && !talk) {
      this.prompt.setVisible(false);
      this.promptLabel = '';
      return;
    }
    const top = talk ? this.world.keshPrompt() : near ? this.world.propTop(near.station.id, p) : null;
    const at = top ? { x: simPx(top.x), y: simPx(top.y) } : { x: 0, y: 0 };
    const ui = this.toUi(at.x, at.y);
    this.promptLabel = talk ? TALK_LABEL : USE_LABEL;
    this.prompt
      .setItems([...hintItems(this.controls.hint('interact')), { text: this.promptLabel }])
      .place(ui.x, ui.y, 0.5, 1)
      .setVisible(true);
  }

  /**
   * A float: "+1" as a cycle completes and "+3" as a take-all moves a basket, over the station's part nearest the
   * Kindled; "+1" where Kesh's sliver lands. `at` gives the place (sim px) each frame.
   */
  private float(text: string, at: string | (() => { x: number; y: number } | null)): void {
    const t = shadowed(label(this, 0, 0, text, Palette.spark));
    t.setDepth(DEPTH.floaters);
    this.hudLayer.add(t);
    if (typeof at === 'string') {
      const near = this.session.position();
      this.floaters.push({ text: t, at: () => this.world.propTop(at, near), life: FLOAT_MS });
    } else {
      const feet = at();
      // Over the Kindled who picked it up, as the station floats rise over their props (the sliver lands at the feet).
      this.floaters.push({ text: t, at: () => (feet ? { x: worldPx(feet.x), y: worldPx(feet.y) - FLOAT_OVER_KINDLED } : null), life: FLOAT_MS });
    }
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
      const top = f.at();
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
    /** Kesh (M2 Task 4b): the prompt's verb, the talk box, his row and frame, the thrown thing in the air. */
    promptLabel: string;
    talk: ReturnType<TalkBox['snapshot']> | null;
    talkRect: ViewRect | null;
    kesh: ReturnType<HoldingWorld['keshState']>;
    /** The camera's scroll (world px). */
    scroll: { x: number; y: number };
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
      promptLabel: this.promptLabel,
      talk: this.talkBox?.snapshot() ?? null,
      talkRect: this.talkBox?.rect() ?? null,
      kesh: this.world.keshState(),
      scroll: { ...this.scroll },
    };
  }

  override update(_time: number, delta: number): void {
    const refit = this.fitCameras();
    this.session.update(delta);
    if (this.session.pressed & Button.Interact) this.use();
    this.followCamera(refit || this.session.state.tick <= 1);
    this.world.setKeshTalking(this.talkBox !== null && keshSpeaking(this.talk.step));
    this.world.draw(this.session.state, this.session.position());
    this.hud.draw(
      chipState(this.response, this.serverNow()),
      packFill(this.inventory),
      purseGin(this.inventory),
      this.writHud(),
      this.letterSheet,
      this.bodyRects(),
      delta,
    );
    this.updatePrompt();
    this.updateFloaters(delta);
    this.updatePanelResult();
    if (this.nameScreen) {
      this.nameScreen.update(this.game.canvas);
      if (this.nameScreen.done) {
        this.closeNameScreen();
        this.afterNaming();
      }
    }
    this.writPanel?.update(this.serverNow());
    this.talkBox?.layout();

    // The pad: Circle backs out, the D-pad moves the panel's focus, Cross presses it (Cross is also interact in
    // Calm, which `use` handles through the roam's input while no panel is open). No stop binding: the chip and the panel.
    const edges = padEdges(this.pad);
    const preset = controlsStore.get();
    if (edges.includes(MENU_BUTTONS.back)) this.back();
    else if (this.talkBox) {
      const axes = connectedPad()?.axes ?? [];
      const sy = Math.abs(axes[1] ?? 0) > 0.5 ? Math.sign(axes[1] ?? 0) : 0;
      const pushedY = sy !== 0 && sy !== this.stick.y ? sy : 0;
      this.stick = { x: 0, y: sy };
      if (edges.includes(MENU_BUTTONS.up) || pushedY < 0) {
        this.talk.moveFocus(-1);
        this.syncTalk();
      } else if (edges.includes(MENU_BUTTONS.down) || pushedY > 0) {
        this.talk.moveFocus(1);
        this.syncTalk();
      } else if (edges.includes(MENU_BUTTONS.confirm[0]) && !buttonsFor(preset, 'interact', 'calm').includes(MENU_BUTTONS.confirm[0])) this.talkAdvance();
      else if (MENU_BUTTONS.confirm.slice(1).some((b) => edges.includes(b))) this.talkAdvance();
    } else if (this.writPanel) {
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

/** The UI rectangle spanning two projected corners, rounded outwards. */
function outward(a: { x: number; y: number }, b: { x: number; y: number }): UiRect {
  const x0 = Math.floor(Math.min(a.x, b.x));
  const y0 = Math.floor(Math.min(a.y, b.y));
  return { x: x0, y: y0, w: Math.ceil(Math.max(a.x, b.x)) - x0, h: Math.ceil(Math.max(a.y, b.y)) - y0 };
}
