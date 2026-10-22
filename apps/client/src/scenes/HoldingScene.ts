import Phaser from 'phaser';
import {
  ApiErrorCode,
  awayLines,
  BUILD_TEXT,
  HOLDING_CAMERA_MARGIN_TILES,
  HOLDING_HEARTBEAT_MS,
  holdingLayout,
  keshData,
  layoutPlot,
  PLOT_TEXT,
  plotKindDef,
  plotLabel,
  shapeLetters,
  SLEEP_SIT_MS,
  TILE_SIZE_PX,
  TOAST_TEXT,
  wordDef,
  type AwayCard,
  type ClayTone,
  type HoldingResponse,
  type InventoryResponse,
  type LayoutPlot,
  type PlotView,
  type TilePoint,
} from '@iot/shared';
import { Button, SUB, TILE_PX, type RoamState } from '@iot/sim';
import { accountStore, api } from '../api.js';
import { deviceStore } from '../game/activeDevice.js';
import {
  buildHeader,
  cursorStart,
  ghostAt,
  ghostFit,
  pieceAt,
  pieceRows,
  pieceWorldRect,
  plotPieceTiles,
  refundFloats,
  rotateGhost,
  stepCursor,
  tileOfSim,
  tileOfWorld,
  type Ghost,
} from '../game/buildView.js';
import { Controls } from '../game/controls.js';
import { controlsStore } from '../game/controlsStore.js';
import { buttonsFor, connectedPad, MENU_BUTTONS, padEdges, padEdgeState } from '../game/gamepad.js';
import {
  chipState,
  clockOffset,
  cyclesDone,
  flowButtons,
  interactPoint,
  nearestStationPart,
  nearKesh,
  packFill,
  purseGin,
  serverTime,
  stationLines,
  takeFloat,
  talkSpot,
  USE_LABEL,
  workplaceDef,
  type NearStation,
  type StationButton,
  type StationLines,
  type UiRect,
} from '../game/holdingView.js';
import { REFUSAL_LIFE_MS, refusalVisible } from '../game/inventoryView.js';
import {
  defaultToastStorage,
  LevelMemory,
  levelUps,
  packFullToast,
  skillLevels,
  skillLevelToast,
  storeFullToast,
  WritToastMemory,
  writToastsDue,
} from '../game/toastView.js';
import {
  KeshTalk,
  keshSpeaking,
  TALK_LABEL,
  type TalkContext,
  type TalkFlow,
} from '../game/keshTalk.js';
import {
  cyclesLanded,
  namedPlotIds,
  onSignpost,
  plotAtWorld,
  plotOf,
  type Picked,
} from '../game/plotView.js';
import { derive, hudName, writChip } from '../game/writView.js';
import { keyboardKeys, keyCodeFor } from '../game/keyboard.js';
import { findPath, PathWalk, walkGoal, waypoints } from '../game/path.js';
import { RoamSession } from '../game/roamSession.js';
import { tuningStore } from '../game/tuningStore.js';
import {
  fitUi,
  fitWorldView,
  viewInUi,
  type Rect as ViewRect,
  type UiFit,
  type WorldFit,
} from '../game/view.js';
import { Palette } from '../palette.js';
import { button, type Button as MenuButton } from '../render/button.js';
import { clampScroll } from '../render/camera.js';
import { DEPTH } from '../render/depth.js';
import { hintItems, HintRow } from '../render/hint.js';
import { HoldingHud, type WritHud } from '../render/holdingHud.js';
import { loadLetterSheet, plotLetters, type LetterSheet } from '../render/letters.js';
import { uiToCss } from '../render/cameras.js';
import { HoldingWorld, type TossKind } from '../render/holdingWorld.js';
import { menuCursor } from '../render/menus.js';
import { PiecesLayer } from '../render/pieces.js';
import { PlotsLayer } from '../render/plots.js';
import { HOLDING_SHEET, preloadTileSheet } from '../render/roomTiles.js';
import { simPx, worldPx } from '../render/scale.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { preloadSpriteSheets, registerSpriteSheets } from '../render/spriteSheets.js';
import {
  blinkOut,
  body,
  label,
  place,
  preloadFonts,
  registerFonts,
  shadowed,
  type Shadowed,
  type Text,
} from '../render/text.js';
import { divider, panel } from '../render/ui.js';
import { AwayCardPanel } from '../ui/awayCard.js';
import { BuildMode } from '../ui/buildMode.js';
import { NameScreen } from '../ui/nameScreen.js';
import { PlotPanel } from '../ui/plotPanel.js';
import { TalkBox } from '../ui/talkBox.js';
import { toastStore } from '../ui/toasts.js';
import { RackPanel } from '../ui/rackPanel.js';
import { TouchControls } from '../ui/touchControls.js';
import { WritPanel } from '../ui/writPanel.js';
import type { InventoryData } from './InventoryScene.js';

/** The station panel (UI px): a small panel over the view's centre with the station's lines and its buttons. */
const PANEL_W = 176;
const PANEL_PAD = 8;
/** A "+1" (or a take-all's "+3") floater rises this far over its life, and blinks out over the last 200 ms. */
const FLOAT_MS = 700;
/** A take-down's floats, one per item (LORE), rise together one text line apart (world px) so they never overlap. */
const REFUND_FLOAT_LINE_PX = 24;
const FLOAT_RISE = 10;
const FLOAT_BLINK_MS = 200;
/** How far over the Kindled's position (world px) a float over them starts: clear of the head. */
const FLOAT_OVER_KINDLED = 40;
/** The letters on a panel (a plot's sentence) and in a float (the tile's word) are drawn at 2 UI px per sheet px. */
const LETTER_SCALE = 2;

/**
 * A word's letters floating like a "+1" (M2 Task 5: Kesh's tile lands showing
 * its word, not a count): a Graphics drawn from the letter sheet, placed and
 * blinked out like the text floats. `text` is the letters, for the playtests.
 */
class LetterFloat extends Phaser.GameObjects.Container {
  readonly text: string;

  constructor(scene: Phaser.Scene, sheet: LetterSheet, letters: string) {
    super(scene, 0, 0);
    this.text = letters;
    const g = scene.add.graphics();
    const shape = shapeLetters(letters);
    plotLetters(g, sheet, letters, 0, 0, { scale: LETTER_SCALE });
    this.add(g);
    this.setSize(shape.width * LETTER_SCALE, shape.height * LETTER_SCALE);
    scene.add.existing(this);
  }
}

interface Floater {
  text: Shadowed | LetterFloat;
  /** Where it floats (sim px) each frame: over a station's part, or where Kesh's sliver landed. */
  at: () => { x: number; y: number } | null;
  life: number;
}

interface StationPanel {
  /** The station's id, or a named plot's. */
  id: string;
  g: Phaser.GameObjects.Graphics;
  /** The title, then the lines in `stationLines`' order: letters are drawn into `face`. */
  title: Text;
  face: Phaser.GameObjects.Graphics;
  rows: Text[];
  buttons: { kind: StationButton; button: MenuButton }[];
  focus: number;
  result: Text;
  resultAt: number;
  /** The lines shown, from the latest answer (null until the station's data is known). */
  lines: StationLines | null;
  /** Where it was last laid out (UI px): a tap outside it closes it (M2 Task 10). */
  rect: ViewRect;
}

/** What Use (or a tap on it, M2 Task 10) works: Kesh across the water, or a station's part or a plot. */
type UseTarget = { kind: 'kesh' } | { kind: 'part'; near: NearStation };

const inside = (r: ViewRect, x: number, y: number): boolean => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

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
 * and a line that tosses asks the server for the thrown thing (the count
 * comes from its answer; the flight is cosmetic). The plots (M2 Task 5,
 * render/plots.ts): once the island has a Name, Use on an unnamed plot opens
 * the plot sentence panel (ui/plotPanel.ts), a named plot the station panel
 * of its kind (SOW until it is sown; RENAME opens the sentence panel again);
 * a naming's answer plays the seal scene, and the first one Kesh's seeds.
 * Build mode (M2 Task 6, ui/buildMode.ts, render/pieces.ts): BUILD HERE in
 * a field's panel opens it; a piece picked from the side list becomes a
 * ghost on the pointer (or the pad's tile cursor), green where it fits, R or
 * Triangle turns it, Confirm sends the build, and the building moment plays
 * on the server's answer; a standing piece selected offers MOVE and TAKE
 * DOWN. Sleep, the away card and the toasts (M2 Task 7): SLEEP on the Writ
 * panel (and the Name screen) cuts to the sleep scene, which logs out; an
 * answer carrying an away card opens it over the holding (ui/awayCard.ts),
 * closed by any input, which does nothing else, and dismissed on the server
 * with away/seen; the toasts (ui/toasts.ts, a scene over everything) are
 * fed from the answers: a level gained in this session, the Writ under a
 * day or dark once per drain, a take-all's full store, a full pack.
 * Positions are the client's; every count comes from the server.
 */
export class HoldingScene extends Phaser.Scene {
  session!: RoamSession;
  controls!: Controls;
  world!: HoldingWorld;
  private plots!: PlotsLayer;
  private pieces!: PiecesLayer;
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
  /** The left stick's last direction on a panel (−1, 0, 1 per axis), so a push moves the focus once. */
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
  /** The weapon rack's panel (M2 Task 8), open over the rack. */
  private rackPanel: RackPanel | null = null;
  private nameScreen: NameScreen | null = null;
  /** The plot sentence panel (M2 Task 5), over a plot. */
  private plotPanel: PlotPanel | null = null;
  private plotPanelFor: string | null = null;
  /** What follows the seal scene (Kesh's seeds after the first naming). */
  private afterSeal: (() => void) | null = null;
  /** Build mode (M2 Task 6): the side list, the plot it is open on, the ghost, the pad's tile cursor and the selected standing piece. */
  private build: BuildMode | null = null;
  private buildPlot: LayoutPlot | null = null;
  private ghost: Ghost | null = null;
  private cursor: TilePoint = { col: 0, row: 0 };
  private selectedPiece: string | null = null;
  /** The last tile a touch tap put the ghost on: a second tap there confirms. */
  private tapTile: TilePoint | null = null;
  /** The cycles each clock had landed when last looked, for the "+1" floats over the signposts and the trees. */
  private lastLanded: Record<string, number> = {};
  /** The talk box (M2 Task 4b): Kesh's lines, one at a time, and the menu of topics. */
  private readonly talk = new KeshTalk();
  private talkBox: TalkBox | null = null;
  /** What follows once the box closes (the Writ panel after the naming lines). */
  private afterTalk: (() => void) | null = null;
  /** The step whose toss was asked of the server, so a line asks once. */
  private tossAsked: unknown = null;
  /** The Old Letters sheet's ink, once loaded (the Name screen, the Writ panel, the HUD and the plots draw from it). */
  private letterSheet: LetterSheet | null = null;
  private floaters: Floater[] = [];
  /** The cycles the ring had completed when last looked, for the "+1" prediction. */
  private lastCycles = -1;
  private heartbeat: Phaser.Time.TimerEvent | null = null;
  /** The seal's tooltip while the pointer is over a named plot (LORE's line), on the UI layer. */
  private plotTipG!: Phaser.GameObjects.Graphics;
  private plotTip!: Text;
  /** The away card (M2 Task 7) while it is open, the card it shows, and the input that closes it (acted on next frame). */
  private away: AwayCardPanel | null = null;
  private awayCard: AwayCard | null = null;
  private awayDismiss = false;
  /** The `to` of the card last dismissed: an answer already in flight may still carry it; it comes back only if the dismissal failed. */
  private awayDismissedTo: string | null = null;
  /** Which drain each Writ toast was shown for, per Kindled, in localStorage. */
  private readonly writMemory = new WritToastMemory(defaultToastStorage());
  private readonly levelMemory = new LevelMemory(defaultToastStorage());
  /** The last error a request answered (playtests). */
  lastError = '';
  /** Between create and shutdown: answers that arrive after the scene is gone are dropped. */
  private alive = false;
  /** The touch layer (M2 Task 10): the stick, USE alone above the pack button, the gear. */
  touch!: TouchControls;
  /** The tap walk (M2 Task 10): the path being walked and what to use on arrival (null: plain ground). */
  private walk: { path: PathWalk; then: UseTarget | null } | null = null;
  /** A walk that just ended, its thing used next frame if the Kindled is in reach. */
  private arrived: UseTarget | null = null;

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
    this.rackPanel = null;
    this.nameScreen = null;
    this.plotPanel = null;
    this.plotPanelFor = null;
    this.afterSeal = null;
    this.build = null;
    this.buildPlot = null;
    this.ghost = null;
    this.selectedPiece = null;
    this.tapTile = null;
    this.lastLanded = {};
    this.talkBox = null;
    this.afterTalk = null;
    this.tossAsked = null;
    this.talk.close();
    this.floaters = [];
    this.lastCycles = -1;
    this.lastError = '';
    this.away = null;
    this.awayCard = null;
    this.awayDismiss = false;
    this.awayDismissedTo = null;
    toastStore.queue.clear();
    toastStore.paused = false;
    // The toast strip: a scene over everything, the inventory included; stopped with this one.
    this.scene.launch('toasts');
    this.alive = true;
    if (!this.letterSheet)
      void loadLetterSheet().then(
        (sheet) => {
          if (!this.alive) return;
          this.letterSheet = sheet;
          this.plots.setSheet(sheet);
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
    this.world = new HoldingWorld(
      this,
      this.worldLayer,
      layout,
      () => tuningStore.get().anim,
      tone,
      () => tuningStore.get().kesh,
      accountStore.current?.kindled?.remembrance ?? 'ash',
    );
    this.world.sitting = null;
    this.plots = new PlotsLayer(this, this.worldLayer, layout, () => tuningStore.get().plots);
    this.plots.setSheet(this.letterSheet);
    this.pieces = new PiecesLayer(
      this,
      this.worldLayer,
      this.hudLayer,
      layout,
      () => tuningStore.get().plots,
      (x, y) => this.worldToUi(x, y),
    );
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
    this.plotTipG = this.add.graphics().setDepth(DEPTH.prompt).setVisible(false);
    this.plotTip = body(this, 0, 0, PLOT_TEXT.SEAL_TIP, Palette.uiInk)
      .setDepth(DEPTH.prompt)
      .setVisible(false);
    this.hudLayer.add([this.plotTipG, this.plotTip]);

    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.hudLayer);
    this.cameras.main.setOrigin(0, 0);
    this.uiCam.setOrigin(0, 0);
    this.fitKey = '';
    this.fitCameras();
    menuCursor(this);

    // The touch layer, before the scene's own pointer handler (it reads what is open before a tap changes it).
    this.walk = null;
    this.arrived = null;
    this.touch = new TouchControls(this, {
      mode: 'holding',
      layer: this.hudLayer,
      uiZoom: () => this.uiFit.zU,
      avoid: () => [...this.hud.panelRects(), ...(this.build ? [this.build.rect()] : [])],
      // USE whenever a prompt is up (ART's answer 3), the gear always.
      showing: (id) => id !== 'use' || this.prompt.container.visible,
      stickAllowed: () => !this.modalOpen(),
      // The away card, the talk box, build mode and the Name screen keep their own touches; the gear still works over them.
      claim: (_p, onControl) => !this.away && (onControl || (!this.talkBox && !this.build && !this.nameScreen)),
      onTap: (x, y) => {
        this.touchTap(x, y);
      },
      onControl: (id) => {
        // The gear is the menu binding (Esc): it closes what is open, else leaves for the start screen.
        if (id === 'gear') this.back();
      },
      onTouch: () => {
        this.walk = null;
      },
    });
    this.controls.touch = this.touch.input;
    this.session.steer = (s, manual) => this.steerWalk(s, manual);

    // Keys from controls.json: the inventory opens the inventory, the menu key backs out (the panel first);
    // Enter presses the panel's focused button, the arrows and Tab move its focus.
    const kb = this.input.keyboard;
    const bind = (keys: string[], fn: () => void): void => {
      for (const k of keys) {
        const code = keyCodeFor(k);
        if (code !== undefined) kb?.addKey(code, true).on('down', fn);
      }
    };
    // The away card closes on the first key, and that key does nothing else: every handler yields to it while it is
    // open, and the card is closed at the start of the next frame (M2 Task 7).
    kb?.on('keydown', () => {
      if (this.away) this.awayDismiss = true;
    });
    bind(keyboardKeys('inventory'), () => {
      if (this.away) return;
      if (!this.writPanel && !this.plotPanel && !this.rackPanel) this.openInventory();
    });
    bind(keyboardKeys('menu'), () => {
      if (this.away) return;
      this.back();
    });
    // R turns the ghost (the `rotate` binding, M2 Task 6).
    bind(keyboardKeys('rotate'), () => {
      if (this.away) return;
      this.turnGhost();
    });
    kb?.on('keydown-ENTER', () => {
      if (this.away) return;
      if (this.talkBox) {
        this.keyNav = true;
        this.talkAdvance();
      } else if (this.build) {
        this.keyNav = true;
        if (this.ghost) this.confirmGhost();
        else this.build.press();
      } else if (this.writPanel) {
        this.keyNav = true;
        this.writPanel.press();
      } else if (this.rackPanel) {
        this.keyNav = true;
        this.rackPanel.press();
      } else if (this.plotPanel) {
        this.keyNav = true;
        this.plotPanel.press();
      } else this.pressFocused();
    });
    for (const key of ['LEFT', 'RIGHT', 'TAB'])
      kb?.on(`keydown-${key}`, () => {
        if (this.away) return;
        if (this.talkBox) {
          this.keyNav = true;
          if (key === 'TAB') this.talk.moveFocus(1);
          this.syncTalk();
        } else if (this.build) {
          this.keyNav = true;
          if (key === 'TAB') this.build.moveFocus(1);
        } else if (this.writPanel) {
          this.keyNav = true;
          if (key === 'TAB') this.writPanel.moveFocus(1);
          else this.writPanel.moveSide(key === 'LEFT' ? -1 : 1);
        } else if (this.rackPanel) {
          this.keyNav = true;
          if (key === 'TAB') this.rackPanel.moveFocus(1);
        } else if (this.plotPanel) {
          this.keyNav = true;
          if (key === 'TAB') this.plotPanel.moveFocus(1);
          else this.plotPanel.moveSide(key === 'LEFT' ? -1 : 1);
        } else this.moveFocus(1);
      });
    for (const key of ['UP', 'DOWN'])
      kb?.on(`keydown-${key}`, () => {
        if (this.away) return;
        if (this.talkBox) {
          this.keyNav = true;
          this.talk.moveFocus(key === 'UP' ? -1 : 1);
          this.syncTalk();
          return;
        }
        if (this.build) {
          this.keyNav = true;
          this.build.moveFocus(key === 'UP' ? -1 : 1);
          return;
        }
        if (this.writPanel) {
          this.keyNav = true;
          this.writPanel.moveFocus(key === 'UP' ? -1 : 1);
        } else if (this.rackPanel) {
          this.keyNav = true;
          this.rackPanel.moveFocus(key === 'UP' ? -1 : 1);
        } else if (this.plotPanel) {
          this.keyNav = true;
          this.plotPanel.moveFocus(key === 'UP' ? -1 : 1);
        }
      });

    // A tap on the world is Use (interact is E, Cross or a tap); taps on the HUD's zones are theirs. While the
    // talk box shows a line, a click or tap anywhere advances it (the menu's rows take their own presses).
    this.input.on(
      'pointerdown',
      (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
        // A mouse button or a touch closes the away card and does nothing else.
        if (this.away) {
          this.awayDismiss = true;
          return;
        }
        // A touch on the gear or USE is the touch layer's alone.
        if (p.wasTouch && this.touch.hits(p)) return;
        if (this.talkBox) {
          if (over.length === 0 && this.talk.step.kind === 'line') this.talkAdvance();
          return;
        }
        if (this.build) {
          if (over.length === 0) this.buildPointer(p);
          return;
        }
        // A tap on the world walks there and uses what it lands on: the touch layer's tap (touchTap).
      },
    );
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
      this.touch.destroy();
      this.session.steer = null;
      this.walk = null;
      this.closeTalk();
      this.closeNameScreen();
      this.closeWritPanel();
      this.closeRackPanel();
      this.closePlotPanel();
      this.closeBuild();
      this.dropAway();
      this.scene.stop('toasts');
      this.pieces.destroy();
      this.plots.destroy();
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

  /** The UI camera's zoom, device px per UI px (playtests map UI px to the page). */
  uiZoom(): number {
    return this.uiFit.zU;
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
    // The cycle clocks as answered: a float only for a cycle that lands while watching, never for the settle's.
    this.lastLanded = Object.fromEntries(
      Object.entries(res.value.cycles).map(([id, c]) => [id, cyclesLanded(c, this.serverNow())]),
    );
    this.lastError = '';
    // The plots (M2 Task 5): drawn once the island has a Name; a named plot's signpost is a pillar for the roam.
    this.plots.sync(res.value.plots, res.value.writ.name !== null, res.value.writ);
    // The pieces standing in the plots (M2 Task 6): drawn, and pillars for the roam with the signposts.
    this.pieces.sync(res.value.plots);
    this.session.setSolidPlots(namedPlotIds(res.value), plotPieceTiles(res.value.plots));
    this.syncPanel();
    this.syncWritPanel();
    this.syncRackPanel();
    this.syncPlotPanel();
    this.syncBuild();
    this.syncAway();
    // A skill's level above the last this account saw is a toast (M2 Task 7; GAME DESIGN: an absence under 30 min
    // shows no card, but its toasts show on return); none on an answer carrying the card, which says it, and none
    // with nothing remembered (a new browser). The levels seen are written on every answer.
    const who = this.who();
    for (const up of levelUps(this.levelMemory.read(who), res.value)) {
      const toast = skillLevelToast(up.skill, up.level);
      toastStore.post('skill-level', toast.text, toast.glyph);
    }
    this.levelMemory.write(who, skillLevels(res.value));
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
      // Build mode's list counts the store: the holding's answer may land first and sync it with the old counts.
      this.syncBuild();
    });
  }

  private request(
    call: () => ReturnType<typeof api.holding>,
    then?: () => void,
    refused?: (message: string) => void,
  ): void {
    if (this.busy) return;
    this.busy = true;
    void call().then((res) => {
      if (!this.alive) return;
      this.busy = false;
      if (this.take(res)) then?.();
      else refused?.(this.lastError);
    });
  }

  /** Work here (or switch here): POST /api/holding/work. */
  work(stationId: string): void {
    this.request(
      () => api.holdingWork({ stationId }),
      undefined,
      (message) => {
        this.panelResult(stationId, message);
      },
    );
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
          // "Store: twisted logs full." is a toast since Task 7, no longer the panel's line.
          const full = storeFullToast(take);
          if (full) toastStore.post('store-full', full.text, full.glyph);
        }
        void api.inventory().then((res) => {
          if (this.alive && res.ok) this.inventory = res.value;
        });
      },
      (message) => {
        this.panelResult(stationId, message);
      },
    );
  }

  /** Sow a named field (M2 Task 5): POST /api/plots/sow; a refusal is the panel's one line. */
  sow(plotId: string): void {
    this.request(
      () => api.plotsSow({ plotId }),
      () => {
        void api.inventory().then((res) => {
          if (this.alive && res.ok) this.inventory = res.value;
        });
      },
      (message) => {
        this.panelResult(plotId, message);
      },
    );
  }

  /** The station panel's one line (a refusal or the full-store line), with the inventory's blink-and-hold timing. */
  private panelResult(stationId: string, line: string): void {
    if (this.panel?.id !== stationId) return;
    this.panel.result.setText(line).setVisible(true);
    this.panel.resultAt = this.time.now;
    this.placePanel(this.panel);
  }

  // --- Interaction -------------------------------------------------------

  /** Whether the island has a Name: the plots appear only once it does. */
  private get named(): boolean {
    return this.response?.writ.name !== null && this.response?.writ.name !== undefined;
  }

  /** The station part in reach of the Kindled, if any (the prompt's rules and range; a reserved spot never is; the plots once named). */
  private near(): NearStation | null {
    const p = this.session.position();
    return nearestStationPart(
      p.x,
      p.y,
      tuningStore.get().juice.promptRangePx,
      this.session.layout,
      this.named,
    );
  }

  /**
   * Use: the post opens the Writ panel (the Name screen first, unnamed); the store opens the inventory with the
   * store pane; the weapon rack opens the rack panel (M2 Task 8); a tree or the outcrop opens its panel; an unnamed plot the plot sentence panel, a named plot its
   * station panel; the Talk spot across the water from Kesh opens the talk box, and while it is open Use advances it.
   */
  private use(): void {
    if (this.away) {
      this.awayDismiss = true;
      return;
    }
    if (this.nameScreen) return;
    if (this.talkBox) {
      this.talkAdvance();
      return;
    }
    if (this.writPanel) {
      this.closeWritPanel();
      return;
    }
    if (this.rackPanel) {
      this.closeRackPanel();
      return;
    }
    if (this.plotPanel) {
      this.closePlotPanel();
      return;
    }
    if (this.build) return;
    if (this.panel) {
      this.closePanel();
      return;
    }
    const p = this.session.position();
    if (nearKesh(p.x, p.y, tuningStore.get().juice.promptRangePx, this.session.layout)) {
      this.useTarget({ kind: 'kesh' });
      return;
    }
    const near = this.near();
    if (near) this.useTarget({ kind: 'part', near });
  }

  /** Use one thing: Kesh's Talk, a plot (its sentence panel unnamed, else its station panel), or a station by its kind. */
  private useTarget(target: UseTarget): void {
    this.walk = null;
    if (target.kind === 'kesh') {
      this.openTalk('talk');
      return;
    }
    const { near } = target;
    if (near.plot) {
      const view = plotOf(this.response, near.plot.id);
      if (!view) return;
      if (view.ground === null) this.openPlotPanel(near.plot.id);
      else this.openPanel(near.plot.id);
      return;
    }
    const { station } = near;
    if (!station) return;
    if (station.kind === 'post') this.openWrit();
    else if (station.kind === 'store') this.openInventory();
    else if (station.kind === 'rack') this.openRackPanel();
    else this.openPanel(station.id);
  }

  // --- Touch (M2 Task 10) ------------------------------------------------------

  /** Whether something covers the holding: a panel, the talk box, build mode, the away card, the sleep or the seal scene. */
  private modalOpen(): boolean {
    return (
      this.panel !== null ||
      this.writPanel !== null ||
      this.rackPanel !== null ||
      this.nameScreen !== null ||
      this.talkBox !== null ||
      this.plotPanel !== null ||
      this.build !== null ||
      this.away !== null ||
      this.world.sitting !== null ||
      this.plots.sealing !== null
    );
  }

  /** A UI point on the world, in world px (through the world camera). */
  private uiToWorld(x: number, y: number): { x: number; y: number } {
    const w = this.worldFit;
    const z = this.uiFit.zU;
    return { x: (x * z - w.x) / w.zW + this.scroll.x, y: (y * z - w.y) / w.zW + this.scroll.y };
  }

  /**
   * A touch tap (UI px, on nothing the HUD or a panel takes): with a panel
   * open, a tap outside it closes it (Circle's meaning); else tap to walk and
   * use (holding.md §6).
   */
  private touchTap(x: number, y: number): void {
    if (this.away || this.talkBox || this.build || this.nameScreen) return;
    const open = this.panel?.rect ?? this.writPanel?.rect() ?? this.rackPanel?.rect() ?? this.plotPanel?.rect() ?? null;
    if (open) {
      if (!inside(open, x, y)) this.back();
      return;
    }
    if (this.modalOpen()) return;
    this.tapWorld(x, y);
  }

  /** What a tap on the world (world px) lands on: a station's prop, Kesh or his rock, a plot once the island is named; or nothing. */
  private thingAt(wx: number, wy: number): UseTarget | null {
    const layout = this.session.layout;
    const prop = this.world.propAt(wx, wy);
    if (prop) {
      if (prop.stationId === null) return { kind: 'kesh' };
      const station = layout.stations.find((st) => st.id === prop.stationId);
      const r = prop.rect;
      const part = station?.parts.find((pt) => pt.rect.col === r.col && pt.rect.row === r.row && pt.rect.cols === r.cols && pt.rect.rows === r.rows);
      if (station && part && !station.reserved) return { kind: 'part', near: { id: station.id, station, plot: null, part } };
    }
    const k = this.world.keshBox();
    if (k && inside(k, wx, wy)) return { kind: 'kesh' };
    if (this.named) {
      const plot = plotAtWorld(wx, wy, layout);
      if (plot) return { kind: 'part', near: { id: plot.id, station: null, plot, part: plot.station } };
    }
    return null;
  }

  /** Where a thing is used from (sim px): the Talk spot, or the part's interact point. */
  private targetSpot(target: UseTarget): { x: number; y: number } {
    return target.kind === 'kesh' ? talkSpot(this.session.layout) : interactPoint(target.near.part);
  }

  private inReach(target: UseTarget): boolean {
    const p = this.session.position();
    const at = this.targetSpot(target);
    return Math.hypot(at.x - p.x, at.y - p.y) <= tuningStore.get().juice.promptRangePx;
  }

  /**
   * Tap to walk and use (GAME DESIGN 2026-10-20): on a thing in reach, Use it
   * now; out of reach, walk to its interact point and Use it on arrival; on
   * plain ground, walk there (the nearest walkable tile when it is solid or
   * void). No path: no walk.
   */
  private tapWorld(x: number, y: number): void {
    this.walk = null;
    const w = this.uiToWorld(x, y);
    const target = this.thingAt(w.x, w.y);
    if (target) {
      if (this.inReach(target)) {
        this.useTarget(target);
        return;
      }
      const at = this.targetSpot(target);
      this.walkTo(tileOfSim(at.x, at.y), target);
      return;
    }
    const goal = walkGoal(this.session.tiles, tileOfSim(simPx(w.x), simPx(w.y)));
    if (goal) this.walkTo(goal, null);
  }

  private walkTo(goal: TilePoint, then: UseTarget | null): void {
    const p = this.session.position();
    const path = findPath(this.session.tiles, tileOfSim(p.x, p.y), goal);
    if (!path) return;
    const points = waypoints(path);
    const centre = { x: (goal.col + 0.5) * TILE_SIZE_PX, y: (goal.row + 0.5) * TILE_SIZE_PX };
    this.walk = { path: new PathWalk(points.length > 0 ? points : [centre]), then };
  }

  /** The roam's autopilot each tick while walking: any stick or key, or something opening, ends the walk. */
  private steerWalk(s: RoamState, manual: boolean): { x: number; y: number } | null {
    const walk = this.walk;
    if (!walk) return null;
    if (manual || this.modalOpen()) {
      this.walk = null;
      return null;
    }
    const v = walk.path.step(s.x / SUB, s.y / SUB);
    if (v) return v;
    this.walk = null;
    this.arrived = walk.then;
    return null;
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
      sleep: () => {
        this.sleep();
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
    this.closeRackPanel();
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
      sleep: () => {
        this.sleep();
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
    if (this.writPanel && this.response)
      this.writPanel.sync(this.response.writ, this.inventory, this.serverNow());
  }

  // --- The weapon rack (M2 Task 8) ----------------------------------------------

  /** Use on the rack: the rack panel (ui/rackPanel.ts), the rows from the latest answer's `rack`. */
  private openRackPanel(): void {
    this.closePanel();
    this.closeWritPanel();
    this.closePlotPanel();
    if (this.rackPanel) return;
    this.session.held = true;
    this.rackPanel = new RackPanel({
      scene: this,
      layer: this.hudLayer,
      frame: () => this.frame,
      showFocus: () => this.showFocus(),
      choose: (weaponId) => {
        this.chooseWeapon(weaponId);
      },
    });
    this.syncRackPanel();
    // Opening the panel is an interaction: what hangs there is fresh.
    this.refresh();
  }

  private closeRackPanel(): void {
    if (!this.rackPanel) return;
    this.rackPanel.destroy();
    this.rackPanel = null;
    this.session.held = this.panel !== null || this.writPanel !== null || this.plotPanel !== null || this.build !== null;
  }

  private syncRackPanel(): void {
    if (this.rackPanel && this.response) this.rackPanel.sync(this.response.rack);
  }

  /** TAKE (and the playtests): POST /api/holding/rack/choose; the rows redraw from the answer; a refusal is the panel's footer line. */
  chooseWeapon(weaponId: string): void {
    this.request(
      () => api.rackChoose({ weaponId }),
      undefined,
      (message) => {
        this.rackPanel?.setResult(message);
      },
    );
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
   * the water, the Narrator, the hint, the tile's toss (LORE), then the Writ
   * panel opens.
   */
  private afterNaming(): void {
    this.openTalk('afterNaming', () => {
      this.openWritPanel();
    });
  }

  /** Once a feed has landed: the first time (`writ.fedAt` went from null to set), Kesh's line (LORE). */
  private afterFeeding(fedBefore: string | null): void {
    if (fedBefore === null && this.response?.writ.fedAt !== null)
      this.openTalk('afterFirstFeeding');
  }

  /**
   * SLEEP (M2 Task 7, GAME DESIGN): the panel closes, the Kindled turns to the post and sits down against it (the
   * `sit` row when the sheet has it, else idle, held) for `sleepSitMs`, then the scene cuts, with no fade, to the
   * sleep scene, which logs out after `sleepMs`. This scene's shutdown stops the heartbeat; the active action keeps
   * running on the server up to the cap.
   */
  private sleep(): void {
    if (this.world.sitting) return;
    this.closeWritPanel();
    this.closeNameScreen();
    this.session.held = true;
    const p = this.session.position();
    const post = this.session.layout.stations.find((s) => s.kind === 'post')?.parts[0];
    const at = post
      ? {
          x: (post.rect.col + post.rect.cols / 2) * TILE_SIZE_PX,
          y: (post.rect.row + post.rect.rows) * TILE_SIZE_PX,
        }
      : p;
    // The facing in the sim's 1/4096 turn, 0 east, screen y down.
    const angle = Math.round((Math.atan2(at.y - p.y, at.x - p.x) / (2 * Math.PI)) * 4096) & 4095;
    this.world.sitting = { angle };
    const dark = (this.response?.writ.chargeMs ?? 1) === 0;
    this.time.delayedCall(SLEEP_SIT_MS, () => {
      if (this.alive) this.scene.start('sleep', { dark });
    });
  }

  // --- The away card (M2 Task 7) -------------------------------------------------

  /** Who the Writ toasts are remembered for: the account's one Kindled, by its username (the client never sees a Kindled id). */
  private who(): string {
    return accountStore.current?.account.username ?? 'kindled';
  }

  /**
   * An answer carrying an away card opens it, once nothing else is open (the Name screen first, while the island is
   * unnamed; a panel or the talk box keeps it for the next answer) and unless this very card was just dismissed.
   */
  private syncAway(): void {
    const card = this.response?.away ?? null;
    if (!card || this.away) return;
    if (
      this.nameScreen ||
      this.talkBox ||
      this.writPanel ||
      this.rackPanel ||
      this.plotPanel ||
      this.build ||
      this.panel
    )
      return;
    if (card.to === this.awayDismissedTo) return;
    this.awayCard = card;
    this.awayDismiss = false;
    const writ = this.response?.writ;
    if (!writ) return;
    const lines = awayLines(
      card,
      this.session.layout,
      this.response?.plots ?? [],
      writ,
      this.serverNow(),
    );
    this.away = new AwayCardPanel(
      { scene: this, layer: this.hudLayer, frame: () => this.frame },
      lines,
    );
    // The Kindled stands still; the toasts wait.
    this.session.held = true;
    toastStore.paused = true;
    // The card's Writ line has told this drain: the Writ toasts don't repeat it.
    if (writ.name !== null) {
      const due = writToastsDue(writ, this.serverNow());
      if (due.low) this.writMemory.mark('writLow', this.who(), due.emptyAt);
      if (due.dark) this.writMemory.mark('writDark', this.who(), due.emptyAt);
    }
  }

  /** The card goes without a word to the server (the scene is shutting down): it comes back with the next log-in's answer. */
  private dropAway(): void {
    if (!this.away) return;
    this.away.destroy();
    this.away = null;
    this.awayCard = null;
    this.awayDismiss = false;
    toastStore.paused = false;
  }

  /** The first input closed the card: it goes, and away/seen with its `to` dismisses it on the server; if that fails it comes back with the next answer. */
  private closeAway(): void {
    const card = this.awayCard;
    if (!this.away || !card) return;
    this.dropAway();
    this.session.held =
      this.panel !== null ||
      this.writPanel !== null ||
      this.rackPanel !== null ||
      this.nameScreen !== null ||
      this.plotPanel !== null ||
      this.build !== null ||
      this.talkBox !== null;
    this.awayDismissedTo = card.to;
    void api.awaySeen({ to: card.to }).then((res) => {
      if (!res.ok && this.alive && this.awayDismissedTo === card.to) this.awayDismissedTo = null;
    });
  }

  /** The Writ toasts (M2 Task 7): under a day with charge, and dark, each once per drain, remembered per Kindled; never while the card is open. */
  private updateWritToasts(): void {
    const view = this.response?.writ;
    if (!view || this.away) return;
    const due = writToastsDue(view, this.serverNow());
    const who = this.who();
    if (due.low && !this.writMemory.told('writLow', who, due.emptyAt)) {
      this.writMemory.mark('writLow', who, due.emptyAt);
      toastStore.post('writ-low', TOAST_TEXT.WRIT_LOW, { name: 'writ-low' });
    }
    if (due.dark && !this.writMemory.told('writDark', who, due.emptyAt)) {
      this.writMemory.mark('writDark', who, due.emptyAt);
      toastStore.post('writ-dark', TOAST_TEXT.WRIT_DARK, { name: 'writ-dark' });
    }
  }

  // --- The plots (M2 Task 5) ----------------------------------------------------

  /** Use on an unnamed plot, or RENAME on a named one: the plot sentence panel, with the words the Kindled knows. */
  private openPlotPanel(plotId: string): void {
    this.closePanel();
    this.closeWritPanel();
    this.closeRackPanel();
    const view = plotOf(this.response, plotId);
    if (!view || this.plotPanel) return;
    this.session.held = true;
    this.plotPanelFor = plotId;
    this.plotPanel = new PlotPanel({
      scene: this,
      layer: this.hudLayer,
      frame: () => this.frame,
      sheet: () => this.letterSheet,
      showFocus: () => this.showFocus(),
      confirm: (picked) => {
        this.namePlot(plotId, picked);
      },
    });
    this.plotPanel.open(view, this.response?.words ?? []);
    this.refresh();
  }

  private closePlotPanel(): void {
    if (!this.plotPanel) return;
    this.plotPanel.destroy();
    this.plotPanel = null;
    this.plotPanelFor = null;
    this.session.held = this.panel !== null || this.writPanel !== null || this.rackPanel !== null || this.nameScreen !== null;
  }

  private syncPlotPanel(): void {
    if (!this.plotPanel || !this.plotPanelFor || !this.response) return;
    const view = plotOf(this.response, this.plotPanelFor);
    if (view) this.plotPanel.sync(view, this.response.words);
  }

  /**
   * POST /api/plots/name: the server's answer decides. A refusal is the panel's one line; an accepted sentence
   * closes the panel and plays the seal scene round the plot, and a first naming with Kesh's seeds due plays his
   * `afterFirstPlot` lines once the scene is over.
   */
  private namePlot(plotId: string, picked: Picked): void {
    if (this.busy) return;
    this.busy = true;
    const before = plotOf(this.response, plotId);
    void api.plotsName({ plotId, ground: picked.ground, virtue: picked.virtue }).then((res) => {
      if (!this.alive) return;
      this.busy = false;
      if (!res.ok) {
        this.plotPanel?.setResult(res.message);
        return;
      }
      if (!this.take(res)) return;
      this.closePlotPanel();
      this.plots.startSeal(plotId);
      if (before?.ground === null && this.response?.kesh.seedsDue)
        this.afterSeal = () => {
          this.openTalk('afterFirstPlot');
        };
      void api.inventory().then((inv) => {
        if (this.alive && inv.ok) this.inventory = inv.value;
      });
    });
  }

  /** A plot's tooltip (LORE): the seal's over a named plot, the unnamed plot's line over one without a word, while no panel is open. */
  private updatePlotTip(): void {
    const open =
      this.panel !== null ||
      this.writPanel !== null ||
      this.rackPanel !== null ||
      this.nameScreen !== null ||
      this.talkBox !== null ||
      this.plotPanel !== null ||
      this.build !== null ||
      this.away !== null ||
      this.world.sitting !== null;
    const pointer = this.input.activePointer;
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const plot =
      !open && this.named && deviceStore.get() !== 'gamepad'
        ? plotAtWorld(w.x, w.y, this.session.layout)
        : undefined;
    const view = plot ? plotOf(this.response, plot.id) : undefined;
    const show = view !== undefined;
    this.plotTipG.setVisible(show);
    this.plotTip.setVisible(show);
    if (!show) return;
    // LORE's lines: the unnamed plot's over one without a word yet; over a named plot the signpost's on its signpost,
    // else the seal's.
    this.plotTip.setText(
      view.ground === null
        ? PLOT_TEXT.UNNAMED_PLOT_TIP
        : plot && onSignpost(plot, w.x, w.y)
          ? PLOT_TEXT.SIGNPOST_TIP
          : view.virtue === null
            ? PLOT_TEXT.SEAL_TIP
            : PLOT_TEXT.SEAL_TIP_VIRTUE,
    );
    const ui = this.worldToUi(w.x, w.y);
    const tw = Math.round(this.plotTip.width) + 8;
    const x = Math.round(Math.min(this.frame.x + this.frame.w - tw - 2, ui.x + 6));
    const y = Math.round(ui.y - 16);
    this.plotTipG.clear();
    panel(this.plotTipG, x, y, tw, 11 + 4, { plain: true });
    place(this.plotTip, x + 4, y + 2);
  }

  /** Whether the seal's tooltip shows (playtests). */
  get plotTipVisible(): boolean {
    return this.plotTip.visible;
  }

  // --- Build mode (M2 Task 6) ----------------------------------------------------

  /** BUILD HERE on a field's panel: the side list on the right, the plot's ring on the ground, the camera on the plot. */
  private openBuild(plotId: string): void {
    const plot = layoutPlot(this.session.layout, plotId);
    const view = plotOf(this.response, plotId);
    if (!plot || !view || view.ground === null || this.build) return;
    this.closePanel();
    this.closeWritPanel();
    this.closePlotPanel();
    this.buildPlot = plot;
    this.ghost = null;
    this.selectedPiece = null;
    this.tapTile = null;
    this.cursor = cursorStart(plot);
    this.session.held = true;
    this.build = new BuildMode({
      scene: this,
      layer: this.hudLayer,
      frame: () => this.frame,
      showFocus: () => this.showFocus(),
      pick: (pieceId) => {
        this.pickPiece(pieceId);
      },
      select: (pieceId) => {
        this.selectStanding(pieceId);
      },
      move: () => {
        this.moveSelected();
      },
      takeDown: () => {
        this.takeDownSelected();
      },
      turn: () => {
        this.turnGhost();
      },
    });
    this.pieces.setBuildPlot(plot);
    this.syncBuild();
    this.refresh();
  }

  private closeBuild(): void {
    if (!this.build) return;
    this.build.destroy();
    this.build = null;
    this.buildPlot = null;
    this.ghost = null;
    this.selectedPiece = null;
    this.tapTile = null;
    this.pieces.setBuildPlot(null);
    this.session.held =
      this.panel !== null ||
      this.writPanel !== null ||
      this.rackPanel !== null ||
      this.nameScreen !== null ||
      this.plotPanel !== null;
  }

  /** The side list from the latest answers: the plot's kind, its pieces against the limit, the store's holdings, the Writ's lines. */
  private syncBuild(): void {
    const b = this.build;
    const plot = this.buildPlot;
    const r = this.response;
    if (!b || !plot || !r) return;
    const view = plotOf(r, plot.id);
    const kind =
      view?.kind === null || view?.kind === undefined ? undefined : plotKindDef(view.kind);
    // The plot lost its name (or faded) under us: build mode closes.
    if (!view || !kind || view.state === 'faded') {
      this.closeBuild();
      return;
    }
    if (this.selectedPiece && !view.pieces.some((p) => p.pieceId === this.selectedPiece))
      this.selectedPiece = null;
    // The header names the plot by its label (LORE: "Old field, level 2"; M2 Task 7).
    b.sync(
      buildHeader(view, plotLabel(view, r.plots), r.writ.lineCount),
      pieceRows(kind.id, view, this.inventory, r.writ.lineCount, r.skills),
      this.selectedPiece,
    );
  }

  /** A row of the list picked: its ghost follows the pointer (or the cursor) from here on. */
  private pickPiece(pieceId: string): void {
    const plot = this.buildPlot;
    if (!plot) return;
    this.selectedPiece = null;
    this.pieces.setSelected(null, null);
    this.tapTile = null;
    this.ghost = ghostAt({ pieceId, col: 0, row: 0, rotation: 0, moving: false }, this.ghostTile());
    this.syncBuild();
  }

  /** A standing piece selected (a click on it, or the cursor on it and Cross): MOVE and TAKE DOWN in the list. */
  private selectStanding(pieceId: string): void {
    this.ghost = null;
    this.selectedPiece = pieceId;
    this.pieces.setSelected(this.buildPlot?.id ?? null, pieceId);
    this.syncBuild();
    this.build?.focusButtons();
  }

  /** MOVE: the selected piece becomes the ghost, from where it stands. */
  private moveSelected(): void {
    const plot = this.buildPlot;
    const id = this.selectedPiece;
    const standing =
      plot && id ? this.pieces.piecesIn(plot.id).find((p) => p.pieceId === id) : undefined;
    if (!standing) return;
    this.ghost = { ...standing, moving: true };
    this.tapTile = null;
    this.cursor = { col: standing.col, row: standing.row };
  }

  /** The ghost dropped (or the selection cleared); build mode stays open. */
  private dropGhost(): void {
    this.ghost = null;
    this.selectedPiece = null;
    this.pieces.setSelected(null, null);
    this.tapTile = null;
    this.syncBuild();
  }

  private turnGhost(step: 1 | -1 = 1): void {
    if (this.ghost) this.ghost = rotateGhost(this.ghost, step);
  }

  /** The tile the ghost follows: the pad's cursor in pad mode, the last touch tap, else the pointer's tile through the world camera. */
  private ghostTile(): TilePoint {
    if (deviceStore.get() === 'gamepad') return this.cursor;
    if (this.tapTile) return this.tapTile;
    const pointer = this.input.activePointer;
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return tileOfWorld(w.x, w.y);
  }

  /** Every frame: the ghost under the pointer or the cursor, its colour from the shared placement rule and the Kindled's tile. */
  private updateGhost(): void {
    const plot = this.buildPlot;
    if (!plot || !this.build) {
      this.pieces.setGhost(null);
      return;
    }
    if (this.ghost) {
      const moved = ghostAt(this.ghost, this.ghostTile());
      this.ghost = { ...moved, rotation: this.ghost.rotation };
      const kindled = this.session.position();
      const fit = ghostFit(
        this.session.layout,
        plot,
        this.pieces.piecesIn(plot.id),
        this.ghost,
        tileOfSim(kindled.x, kindled.y),
      );
      this.pieces.setGhost(this.ghost, fit.fits);
      const rect = pieceWorldRect({
        pieceId: this.ghost.pieceId,
        col: this.ghost.col,
        row: this.ghost.row,
        rotation: this.ghost.rotation,
      });
      this.build.setGhostUi(rect ? this.worldToUi(rect.x + rect.w, rect.y - 10) : null);
    } else {
      this.pieces.setGhost(null);
      this.build.setGhostUi(null);
    }
  }

  /** Confirm (LMB, Enter, Cross): the build or the move, at the ghost's place; the server's answer decides. */
  private confirmGhost(): void {
    const ghost = this.ghost;
    const plot = this.buildPlot;
    if (!ghost || !plot || this.busy) return;
    const args = {
      plotId: plot.id,
      pieceId: ghost.pieceId,
      col: ghost.col,
      row: ghost.row,
      rotation: ghost.rotation,
    };
    const moving = ghost.moving;
    this.request(
      () => (moving ? api.plotsMove(args) : api.plotsBuild(args)),
      () => {
        this.ghost = null;
        this.selectedPiece = null;
        this.tapTile = null;
        // The building moment plays on the new piece once the answer has landed, never before.
        if (!moving) this.pieces.startBuild(plot.id, ghost.pieceId);
        this.syncBuild();
        void api.inventory().then((inv) => {
          if (this.alive && inv.ok) {
            this.inventory = inv.value;
            this.syncBuild();
          }
        });
      },
      (message) => {
        this.build?.setResult(message);
      },
    );
  }

  /** TAKE DOWN: the refund floats over the signpost as a take-all's; a refusal is the footer's line. */
  private takeDownSelected(): void {
    const plot = this.buildPlot;
    const pieceId = this.selectedPiece;
    if (!plot || !pieceId || this.busy) return;
    this.request(
      () => api.plotsTakeDown({ plotId: plot.id, pieceId }),
      () => {
        // One float per item, by its display name (LORE), stacked a line apart over the signpost.
        refundFloats(pieceId).forEach((text, i) => {
          this.float(text, plot.id, i * REFUND_FLOAT_LINE_PX);
        });
        this.ghost = null;
        this.selectedPiece = null;
        this.pieces.setSelected(null, null);
        this.syncBuild();
        void api.inventory().then((inv) => {
          if (this.alive && inv.ok) {
            this.inventory = inv.value;
            this.syncBuild();
          }
        });
      },
      (message) => {
        this.build?.setResult(message);
      },
    );
  }

  /** A click or tap on the world in build mode: LMB confirms the ghost or selects a standing piece; RMB cancels; a tap places, a second tap there confirms. */
  private buildPointer(p: Phaser.Input.Pointer): void {
    const plot = this.buildPlot;
    if (!plot) return;
    if (p.rightButtonDown()) {
      this.back();
      return;
    }
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const tile = tileOfWorld(w.x, w.y);
    if (this.ghost) {
      if (p.wasTouch) {
        const same =
          this.tapTile !== null && this.tapTile.col === tile.col && this.tapTile.row === tile.row;
        this.tapTile = tile;
        this.ghost = ghostAt(this.ghost, tile);
        if (!same) {
          this.build?.setResult(BUILD_TEXT.TAP_AGAIN);
          return;
        }
      }
      this.confirmGhost();
      return;
    }
    const standing = pieceAt(this.pieces.piecesIn(plot.id), tile);
    if (standing) this.selectStanding(standing.pieceId);
  }

  /**
   * The pad in build mode, its own buttons like a menu on every preset (GAME DESIGN 2026-10-19): the D-pad or the stick
   * moves the cursor (the list's focus while no ghost is up), Cross confirms or picks, Circle leaves, R1 turns the ghost
   * clockwise and L1 back.
   */
  private buildPad(edges: number[], confirmed: () => boolean): void {
    const b = this.build;
    const plot = this.buildPlot;
    if (!b || !plot) return;
    const axes = connectedPad()?.axes ?? [];
    const sx = Math.abs(axes[0] ?? 0) > 0.5 ? Math.sign(axes[0] ?? 0) : 0;
    const sy = Math.abs(axes[1] ?? 0) > 0.5 ? Math.sign(axes[1] ?? 0) : 0;
    const pushedX = sx !== 0 && sx !== this.stick.x ? sx : 0;
    const pushedY = sy !== 0 && sy !== this.stick.y ? sy : 0;
    this.stick = { x: sx, y: sy };
    const dx =
      edges.includes(MENU_BUTTONS.right) || pushedX > 0
        ? 1
        : edges.includes(MENU_BUTTONS.left) || pushedX < 0
          ? -1
          : 0;
    const dy =
      edges.includes(MENU_BUTTONS.down) || pushedY > 0
        ? 1
        : edges.includes(MENU_BUTTONS.up) || pushedY < 0
          ? -1
          : 0;
    if (edges.includes(MENU_BUTTONS.tabNext) || edges.includes(MENU_BUTTONS.tabPrev)) {
      this.turnGhost(edges.includes(MENU_BUTTONS.tabNext) ? 1 : -1);
      return;
    }
    if (this.ghost) {
      if (dx !== 0 || dy !== 0) this.cursor = stepCursor(this.cursor, dx, dy, plot);
      else if (confirmed()) this.confirmGhost();
      return;
    }
    // No ghost: Up and Down move the list's focus, Left and Right the cursor; Cross selects the piece under the cursor, else presses the focus.
    if (dy !== 0 && b.focusOnRow) b.moveFocus(dy);
    else if (dy !== 0 && !b.focusOnRow) b.moveFocus(dy);
    else if (dx !== 0) this.cursor = stepCursor(this.cursor, dx, 0, plot);
    else if (confirmed()) {
      const standing = pieceAt(this.pieces.piecesIn(plot.id), this.cursor);
      if (standing) this.selectStanding(standing.pieceId);
      else b.press();
    }
  }

  // --- Kesh (M2 Task 4b) ----------------------------------------------------

  /** What the server last said about Kesh, as the flow reads it. */
  private talkContext(): TalkContext {
    const kesh = this.response?.kesh;
    return {
      firstGiven: kesh?.firstGiven ?? true,
      due: kesh?.due ?? null,
      wordDue: kesh?.wordDue ?? false,
      seedsDue: kesh?.seedsDue ?? false,
    };
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
    if (this.talk.step.kind === 'line' && this.talk.step.line.toss !== undefined && this.busy)
      return;
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
      this.askToss(step.line.toss);
    }
  }

  /**
   * The toss: Kesh's `toss` plays at once and the server is asked for the thing (POST /api/kesh/sliver, /word or
   * /seeds); it leaves his hand on the release frame once the server has given it, flies to the Kindled's feet and
   * lands with its float (render only: the counts come from the answer): "+1" for a sliver, the word's letters for
   * the tile, "+4" for the seeds. A refusal ("Pack full.") is the box's note, and nothing flies.
   */
  private askToss(kind: TossKind): void {
    if (this.busy) return;
    this.busy = true;
    let given = false;
    let released = false;
    const launch = (): void => {
      if (!given || !released || !this.alive) return;
      const feet = this.session.position();
      this.world.launchToss(
        feet,
        () => {
          if (kind === 'word')
            this.floatLetters(wordDef(keshData.gifts.word)?.letters ?? '', () => feet);
          else
            this.float(kind === 'seeds' ? `+${keshData.gifts.seeds.quantity}` : '+1', () => feet);
        },
        kind,
      );
    };
    this.world.toss(() => {
      released = true;
      launch();
    });
    const call =
      kind === 'sliver' ? api.keshSliver() : kind === 'word' ? api.keshWord() : api.keshSeeds();
    void call.then((res) => {
      if (!this.alive) return;
      this.busy = false;
      if (!res.ok) {
        // A full pack is a toast (M2 Task 7); any other refusal stays the box's note.
        if (res.error === ApiErrorCode.PackFull) {
          const toast = packFullToast();
          toastStore.post('pack-full', toast.text, toast.glyph);
        } else this.talkBox?.setNote(res.message);
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
    this.session.held =
      this.panel !== null ||
      this.writPanel !== null ||
      this.rackPanel !== null ||
      this.nameScreen !== null ||
      this.plotPanel !== null;
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
    if (this.nameScreen || this.away) return;
    if (this.panel) this.closePanel();
    if (this.writPanel) this.closeWritPanel();
    if (this.rackPanel) this.closeRackPanel();
    if (this.plotPanel) this.closePlotPanel();
    if (this.build) this.closeBuild();
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
    if (this.rackPanel) {
      this.closeRackPanel();
      return;
    }
    if (this.plotPanel) {
      this.closePlotPanel();
      return;
    }
    if (this.build) {
      // Cancel drops the ghost (or the selection); a second cancel leaves build mode.
      if (this.ghost || this.selectedPiece) this.dropGhost();
      else this.closeBuild();
      return;
    }
    if (this.panel) {
      this.closePanel();
      return;
    }
    this.scene.start('start');
  }

  // --- The station panel -------------------------------------------------------

  /** The station panel over a station, or a named plot (its kind's station): the lines of `stationLines` and its buttons. */
  private openPanel(id: string): void {
    this.closePanel();
    this.closeWritPanel();
    this.closeRackPanel();
    const g = this.add.graphics();
    const face = this.add.graphics();
    const title = label(this, 0, 0, '', Palette.uiInk);
    // One text per line `stationLines` may give, in the panel's order (GAME DESIGN 2026-10-18): level, By itself (the
    // cycle), its bonus, By hand, or the highlighted You line in its place while working, basket, next, skill, note.
    const rows = [
      body(this, 0, 0, '', Palette.uiInkMuted),
      body(this, 0, 0, '', Palette.uiInk),
      body(this, 0, 0, '', Palette.uiInkMuted),
      body(this, 0, 0, '', Palette.uiInk),
      body(this, 0, 0, '', Palette.spark),
      body(this, 0, 0, '', Palette.uiInk),
      body(this, 0, 0, '', Palette.uiInkMuted),
      body(this, 0, 0, '', Palette.uiInkMuted),
      // The note (a faded plot's line) wraps to the panel's width.
      body(this, 0, 0, '', Palette.uiInk, PANEL_W - 2 * PANEL_PAD),
    ];
    const result = body(this, 0, 0, '', Palette.uiInk).setVisible(false);
    const p: StationPanel = {
      id,
      g,
      face,
      title,
      rows,
      buttons: [],
      focus: 0,
      result,
      resultAt: -1,
      lines: null,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    };
    this.hudLayer.add([g, face, title, ...rows, result]);
    for (const o of [g, face, title, ...rows, result]) o.setDepth(DEPTH.prompt);
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
    p.face.destroy();
    p.title.destroy();
    for (const t of p.rows) t.destroy();
    p.result.destroy();
    for (const b of p.buttons) b.button.container.destroy(true);
    this.panel = null;
    this.session.held = this.build !== null;
  }

  /** A panel button's word, and what it does. */
  private panelButton(
    p: StationPanel,
    kind: StationButton,
  ): { word: string; primary: boolean; press: () => void } {
    switch (kind) {
      case 'work':
        return {
          word: p.lines?.work ?? 'WORK HERE',
          primary: true,
          press: () => {
            if (this.panel?.lines?.working) this.stop();
            else this.work(p.id);
          },
        };
      case 'take':
        return {
          word: 'TAKE ALL',
          primary: false,
          press: () => {
            this.takeAll(p.id);
          },
        };
      case 'rename':
        return {
          word: PLOT_TEXT.RENAME,
          primary: false,
          press: () => {
            this.openPlotPanel(p.id);
          },
        };
      case 'sow':
        return {
          word: PLOT_TEXT.SOW,
          primary: true,
          press: () => {
            this.sow(p.id);
          },
        };
      case 'build':
        return {
          word: BUILD_TEXT.BUILD_HERE,
          primary: false,
          press: () => {
            this.openBuild(p.id);
          },
        };
    }
  }

  /** The panel's lines from the latest answer; its buttons follow the state (WORK HERE / STOP WORKING, SOW, RENAME, none when faded). */
  private syncPanel(): void {
    const p = this.panel;
    if (!p) return;
    const lines = stationLines(p.id, this.response, this.serverNow());
    p.lines = lines;
    if (!lines) return;
    p.title.setText(lines.title);
    const texts: (string | null)[] = [
      lines.level,
      lines.cycle,
      lines.bonus,
      lines.rate,
      lines.you,
      lines.basket,
      lines.next,
      lines.skill,
      lines.note,
    ];
    texts.forEach((t, i) => {
      p.rows[i]?.setText(t ?? '').setVisible(t !== null);
    });
    // The buttons: rebuilt when their words change (a word changes with the state).
    const want = lines.buttons.map((kind) => `${kind}:${this.panelButton(p, kind).word}`).join('|');
    const have = p.buttons
      .map(
        (b) =>
          `${b.kind}:${b.button.container.list.find((o): o is Text => 'text' in o && typeof (o as Text).text === 'string')?.text ?? ''}`,
      )
      .join('|');
    if (want !== have) {
      for (const b of p.buttons) b.button.container.destroy(true);
      p.buttons = lines.buttons.map((kind) => {
        const spec = this.panelButton(p, kind);
        const b = button(this, 0, 0, spec.word, spec.primary, () => {
          spec.press();
        });
        b.container.setDepth(DEPTH.prompt);
        this.hudLayer.add(b.container);
        return { kind, button: b };
      });
      p.focus = Math.min(p.focus, Math.max(0, p.buttons.length - 1));
    }
    this.placePanel(p);
  }

  /** Lays the panel out over the view's centre: the title (a plot's sentence under it), the lines, a divider, the buttons, the result line. */
  private placePanel(p: StationPanel): void {
    const x = Math.round(this.frame.x + this.frame.w / 2 - PANEL_W / 2);
    const inner = PANEL_W - 2 * PANEL_PAD;
    const letters = p.lines?.letters ?? null;
    const lettersH = letters ? 8 * LETTER_SCALE + 3 : 0;
    const rows = p.rows.filter((t) => t.visible);
    // A row is 11 px, a wrapped note as tall as its lines.
    const rowH = (t: Text): number => Math.max(11, Math.round(t.height) + 3);
    const rowsH = rows.reduce((n, t) => n + rowH(t), 0);
    // The buttons wrap onto as many rows as the panel's width needs, 15 px a row and 4 between.
    const flow = flowButtons(
      p.buttons.map((b) => b.button.width),
      inner,
      6,
      15 + 4,
    );
    const buttonsH = flow.rows > 0 ? 6 + 1 + 6 + flow.rows * 15 + (flow.rows - 1) * 4 : 0;
    const h = PANEL_PAD + 10 + 2 + lettersH + rowsH + buttonsH + 4 + 11 + PANEL_PAD;
    const y = Math.round(this.frame.y + this.frame.h / 2 - h / 2);
    p.rect = { x, y, w: PANEL_W, h: h + 1 };
    p.g.clear();
    p.face.clear();
    panel(p.g, x, y, PANEL_W, h);
    let ly = y + PANEL_PAD;
    place(p.title, x + PANEL_PAD, ly);
    ly += 12;
    if (letters) {
      if (this.letterSheet)
        plotLetters(p.face, this.letterSheet, letters, x + PANEL_PAD, ly, { scale: LETTER_SCALE });
      ly += lettersH;
    }
    for (const t of rows) {
      place(t, x + PANEL_PAD, ly);
      ly += rowH(t);
    }
    if (p.buttons.length > 0) {
      ly += 6;
      divider(p.g, x + PANEL_PAD, ly, inner);
      ly += 1 + 6;
      p.buttons.forEach((b, i) => {
        const at = flow.at[i] ?? { x: 0, y: 0 };
        b.button.container.setPosition(x + PANEL_PAD + at.x, ly + at.y);
        b.button.setFocused(this.showFocus() && i === p.focus);
      });
      ly += flow.rows * 15 + (flow.rows - 1) * 4;
    }
    ly += 4;
    place(p.result, x + PANEL_W - PANEL_PAD, ly, 1);
  }

  /** The panel's focus ring shows on the pad, or once the keys moved it. */
  private keyNav = false;
  private showFocus(): boolean {
    return deviceStore.get() === 'gamepad' || this.keyNav;
  }

  private moveFocus(delta: number): void {
    const p = this.panel;
    if (!p || p.buttons.length === 0) return;
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
    const zone = b.button.container.list.find(
      (o): o is Phaser.GameObjects.Zone => o instanceof Phaser.GameObjects.Zone,
    );
    zone?.emit('pointerdown');
  }

  // --- The frame ------------------------------------------------------------

  private followCamera(snap: boolean): void {
    const j = tuningStore.get().juice;
    const view = this.worldFit;
    const p = this.session.position();
    const s = this.session.state;
    // In build mode the camera stays on the plot (its centre), not the Kindled.
    const target = this.buildPlot
      ? {
          x: (this.buildPlot.rect.col + this.buildPlot.rect.cols / 2) * TILE_SIZE_PX,
          y: (this.buildPlot.rect.row + this.buildPlot.rect.rows / 2) * TILE_SIZE_PX,
        }
      : p;
    const tx = worldPx(target.x) - view.w / 2;
    const ty = worldPx(target.y) - view.h / 2;
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

  /** Where the prompt stands for a station part (world px): over the station's prop, or at an unnamed plot's interact point. */
  private promptTop(
    near: NearStation,
    p: { x: number; y: number },
  ): { x: number; y: number } | null {
    if (near.plot) {
      const top = this.plots.signpostTop(near.plot.id);
      if (top) return top;
      const at = interactPoint(near.part);
      return { x: worldPx(at.x), y: worldPx(at.y) - 8 };
    }
    return this.world.propTop(near.id, p);
  }

  private updatePrompt(): void {
    // No prompt while a panel or the talk box is open, nor over the seal scene.
    const open =
      this.plots.sealing !== null ||
      this.panel !== null ||
      this.writPanel !== null ||
      this.rackPanel !== null ||
      this.nameScreen !== null ||
      this.talkBox !== null ||
      this.plotPanel !== null ||
      this.build !== null ||
      this.away !== null ||
      this.world.sitting !== null;
    const p = this.session.position();
    const talk =
      !open && nearKesh(p.x, p.y, tuningStore.get().juice.promptRangePx, this.session.layout);
    const near = open || talk ? null : this.near();
    if (!near && !talk) {
      this.prompt.setVisible(false);
      this.promptLabel = '';
      return;
    }
    const top = talk ? this.world.keshPrompt() : near ? this.promptTop(near, p) : null;
    const at = top ? { x: simPx(top.x), y: simPx(top.y) } : { x: 0, y: 0 };
    const ui = this.toUi(at.x, at.y);
    this.promptLabel = talk ? TALK_LABEL : USE_LABEL;
    this.prompt
      .setItems([...(this.controls.touchMode ? [] : hintItems(this.controls.hint('interact'))), { text: this.promptLabel }])
      .place(ui.x, ui.y, 0.5, 1)
      .setVisible(true);
  }

  /** Where a station's floats rise from (world px): over its prop nearest the Kindled, or over a plot's signpost. */
  private floatTop(
    stationId: string,
    near: { x: number; y: number },
  ): { x: number; y: number } | null {
    return this.world.propTop(stationId, near) ?? this.plots.signpostTop(stationId);
  }

  /**
   * A float: "+1" as a cycle completes and "+3" as a take-all moves a basket, over the station's part nearest the
   * Kindled (a plot's signpost); "+1" where Kesh's sliver lands. `at` gives the place (sim px) each frame.
   */
  private float(
    text: string,
    at: string | (() => { x: number; y: number } | null),
    below = 0,
  ): void {
    this.addFloater(shadowed(label(this, 0, 0, text, Palette.spark)), at, below);
  }

  /** The word's letters floating where Kesh's tile lands (M2 Task 5), for a float's time; nothing without the sheet. */
  private floatLetters(letters: string, at: () => { x: number; y: number } | null): void {
    if (!this.letterSheet || letters === '') return;
    this.addFloater(new LetterFloat(this, this.letterSheet, letters), at);
  }

  private addFloater(
    t: Shadowed | LetterFloat,
    at: string | (() => { x: number; y: number } | null),
    /** World px under the station's float point (a take-down's second item, a line below the first). */
    below = 0,
  ): void {
    t.setDepth(DEPTH.floaters);
    this.hudLayer.add(t);
    if (typeof at === 'string') {
      const near = this.session.position();
      this.floaters.push({
        text: t,
        at: () => {
          const top = this.floatTop(at, near);
          return top ? { x: top.x, y: top.y + below } : null;
        },
        life: FLOAT_MS,
      });
    } else {
      const feet = at();
      // Over the Kindled who picked it up, as the station floats rise over their props (the thing lands at the feet).
      this.floaters.push({
        text: t,
        at: () => (feet ? { x: worldPx(feet.x), y: worldPx(feet.y) - FLOAT_OVER_KINDLED } : null),
        life: FLOAT_MS,
      });
    }
  }

  /**
   * A "+1" over the station as each cycle of the active action completes, and over a signpost or the nearest tree as a
   * basket cycle lands while watching: predicted from the clocks, render only; the counts come from the server.
   */
  private updateFloaters(delta: number): void {
    const activity = this.response?.activity;
    if (activity) {
      const done = cyclesDone(activity, this.serverNow());
      if (this.lastCycles >= 0 && done > this.lastCycles) {
        this.float('+1', activity.stationId);
        // The panel's "XP to next" follows the cycles (`liveSkill`), like the chip's bar.
        this.syncPanel();
      }
      this.lastCycles = done;
    }
    for (const [id, cycle] of Object.entries(this.response?.cycles ?? {})) {
      const landed = cyclesLanded(cycle, this.serverNow());
      const last = this.lastLanded[id];
      // Only while the Writ has charge: a dark Writ's clocks stand still on the server.
      if (last !== undefined && landed > last && (this.response?.writ.chargeMs ?? 0) > 0) {
        // What one cycle drops into the basket (one item at a time, GAME DESIGN 2026-10-18).
        const n = workplaceDef(id, this.response)?.cycle?.quantity ?? 1;
        this.float(`+${n}`, id);
      }
      this.lastLanded[id] = landed;
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
    /** The pose's sheet facing (S, E, …): the sleep stand-in's is S, its back to the post. */
    facing: string;
    response: HoldingResponse | null;
    panel: string | null;
    /** The station panel's lines as shown. */
    panelLines: StationLines | null;
    result: string;
    /** The floaters alive this frame ("+1", "+3", the tile's letters). */
    floats: string[];
    prompt: boolean;
    chip: ReturnType<typeof chipState>;
    /** Every prop's sheet, frame and depth, and the Kindled's depth, for the draw-order checks. */
    props: ReturnType<HoldingWorld['propFrames']>;
    playerDepth: number;
    /** The Writ (M2 Task 4a): the HUD's block, the panel and the Name screen while open. */
    writ: WritHud | null;
    writPanel: ReturnType<WritPanel['snapshot']> | null;
    /** The weapon rack's panel while open (M2 Task 8). */
    rackPanel: ReturnType<RackPanel['snapshot']> | null;
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
    /** The plots (M2 Task 5): as drawn, the seal scene, the plot sentence panel, the seal's tooltip. */
    plots: ReturnType<PlotsLayer['snapshot']>;
    sealing: string | null;
    plotPanel: ReturnType<PlotPanel['snapshot']> | null;
    plotTip: boolean;
    /** Build mode (M2 Task 6): the side list, the pieces as drawn with the ghost and the building moment, the ghost's placement. */
    build: ReturnType<BuildMode['snapshot']> | null;
    pieces: ReturnType<PiecesLayer['snapshot']>;
    ghost: Ghost | null;
    /** The away card while it is open (M2 Task 7), and its rectangle (UI px). */
    away: ReturnType<AwayCardPanel['snapshot']> | null;
    awayRect: ViewRect | null;
    /** The toasts showing, oldest first. */
    toasts: ReturnType<typeof toastStore.snapshot>;
    /** Sleep's moment at the post: the Kindled sitting (or standing, without a sit row) before the cut. */
    sitting: boolean;
    /** Touch (M2 Task 10): a tap walk under way, and the touch layer as laid out and whether it shows. */
    walking: boolean;
    touch: { shown: boolean; controls: TouchControls['layout']['controls']; stickRadius: number };
  } {
    const s = this.session.state;
    return {
      state: { ...this.session.position(), gait: s.gait, facing: s.facing, tick: s.tick },
      pose: this.world.pose ? `${this.world.pose.name}/${this.world.pose.frame}` : '',
      facing: this.world.pose?.facing ?? '',
      response: this.response,
      panel: this.panel?.id ?? null,
      panelLines: this.panel?.lines ?? null,
      result: this.panel?.result.visible ? this.panel.result.text : '',
      floats: this.floaters.map((f) => f.text.text),
      prompt: this.prompt.container.visible,
      chip: chipState(this.response, this.serverNow()),
      props: this.world.propFrames(),
      playerDepth: this.world.playerDepth(),
      writ: this.writHud(),
      writPanel: this.writPanel?.snapshot() ?? null,
      rackPanel: this.rackPanel?.snapshot() ?? null,
      nameScreen: this.nameScreen?.snapshot() ?? null,
      writTip: this.hud.writTipVisible,
      writRect: this.hud.writRect,
      lettersLoaded: this.letterSheet !== null,
      promptLabel: this.promptLabel,
      talk: this.talkBox?.snapshot() ?? null,
      talkRect: this.talkBox?.rect() ?? null,
      kesh: this.world.keshState(),
      scroll: { ...this.scroll },
      plots: this.plots.snapshot(),
      sealing: this.plots.sealing,
      plotPanel: this.plotPanel?.snapshot() ?? null,
      plotTip: this.plotTipVisible,
      build: this.build?.snapshot() ?? null,
      pieces: this.pieces.snapshot(),
      ghost: this.ghost,
      away: this.away?.snapshot() ?? null,
      awayRect: this.away?.rect() ?? null,
      toasts: toastStore.snapshot(),
      sitting: this.world.sitting !== null,
      walking: this.walk !== null,
      touch: { shown: this.touch.shown, controls: this.touch.layout.controls, stickRadius: this.touch.layout.stickRadius },
    };
  }

  override update(_time: number, delta: number): void {
    const refit = this.fitCameras();
    // The input that closed the away card is acted on here, after every handler has yielded to it (M2 Task 7).
    if (this.away && this.awayDismiss) this.closeAway();
    this.session.update(delta);
    if (this.session.pressed & Button.Interact) this.use();
    // A tap walk that ended: its thing is used if the Kindled is in reach of it.
    if (this.arrived) {
      const target = this.arrived;
      this.arrived = null;
      if (!this.modalOpen() && this.inReach(target)) this.useTarget(target);
    }
    this.followCamera(refit || this.session.state.tick <= 1);
    this.world.setKeshTalking(this.talkBox !== null && keshSpeaking(this.talk.step));
    this.world.draw(this.session.state, this.session.position());
    this.plots.update(this.time.now, this.serverNow());
    this.pieces.update(this.time.now);
    this.updateGhost();
    if (this.afterSeal && this.plots.sealing === null) {
      const next = this.afterSeal;
      this.afterSeal = null;
      next();
    }
    this.hud.draw(
      chipState(this.response, this.serverNow()),
      packFill(this.inventory),
      purseGin(this.inventory),
      this.writHud(),
      this.letterSheet,
      this.bodyRects(),
      delta,
      toastStore.rect,
    );
    toastStore.dither = this.hud.toastsDithered;
    this.touch.update(delta);
    this.updateWritToasts();
    this.updatePrompt();
    this.updatePlotTip();
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
    this.rackPanel?.update();
    this.plotPanel?.update();
    this.build?.update();
    this.talkBox?.layout();
    this.away?.layout();
    // A plot's panel shows "Next in …" from the clock: refresh its lines once a minute.
    if (
      this.panel?.lines?.next &&
      Math.floor(this.serverNow() / 60_000) !== Math.floor((this.serverNow() - delta) / 60_000)
    )
      this.syncPanel();

    // The pad: Circle backs out, the D-pad moves the panel's focus, Cross presses it (Cross is also interact in
    // Calm, which `use` handles through the roam's input while no panel is open). No stop binding: the chip and the panel.
    const edges = padEdges(this.pad);
    const preset = controlsStore.get();
    const confirmed = (): boolean =>
      (edges.includes(MENU_BUTTONS.confirm[0]) &&
        !buttonsFor(preset, 'interact', 'calm').includes(MENU_BUTTONS.confirm[0])) ||
      MENU_BUTTONS.confirm.slice(1).some((b) => edges.includes(b));
    if (this.away) {
      // Any pad button, or a stick pushed past the menu threshold, closes the card and does nothing else.
      const axes = connectedPad()?.axes ?? [];
      const pushed = Math.abs(axes[0] ?? 0) > 0.5 || Math.abs(axes[1] ?? 0) > 0.5;
      if (edges.length > 0 || pushed) this.awayDismiss = true;
      return;
    }
    if (edges.includes(MENU_BUTTONS.back)) this.back();
    else if (this.build) this.buildPad(edges, confirmed);
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
      } else if (confirmed()) this.talkAdvance();
    } else if (this.rackPanel) {
      const axes = connectedPad()?.axes ?? [];
      const sy = Math.abs(axes[1] ?? 0) > 0.5 ? Math.sign(axes[1] ?? 0) : 0;
      const pushedY = sy !== 0 && sy !== this.stick.y ? sy : 0;
      this.stick = { x: 0, y: sy };
      if (edges.includes(MENU_BUTTONS.up) || pushedY < 0) this.rackPanel.moveFocus(-1);
      else if (edges.includes(MENU_BUTTONS.down) || pushedY > 0) this.rackPanel.moveFocus(1);
      else if (confirmed()) this.rackPanel.press();
    } else if (this.writPanel || this.plotPanel) {
      const p = this.writPanel ?? this.plotPanel;
      if (!p) return;
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
      else if (confirmed()) p.press();
    } else if (this.panel) {
      if (
        [MENU_BUTTONS.left, MENU_BUTTONS.right, MENU_BUTTONS.up, MENU_BUTTONS.down].some((b) =>
          edges.includes(b),
        )
      )
        this.moveFocus(1);
      else if (confirmed()) this.pressFocused();
    }
  }
}

/** The UI rectangle spanning two projected corners, rounded outwards. */
function outward(a: { x: number; y: number }, b: { x: number; y: number }): UiRect {
  const x0 = Math.floor(Math.min(a.x, b.x));
  const y0 = Math.floor(Math.min(a.y, b.y));
  return {
    x: x0,
    y: y0,
    w: Math.ceil(Math.max(a.x, b.x)) - x0,
    h: Math.ceil(Math.max(a.y, b.y)) - y0,
  };
}

/** A plot of the layout, for the playtests' scripted walks (its id, rectangle and signpost). */
export function layoutPlotFor(id: string): PlotView['id'] | undefined {
  return holdingLayout().plots.find((p) => p.id === id)?.id;
}
