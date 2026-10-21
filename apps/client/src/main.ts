import Phaser from 'phaser';
import type { ClayTone } from '@iot/shared';
import {
  replayRun,
  hashRunState,
  type AutopilotOptions,
  type Params,
  type RunRecord,
  type RunState,
} from '@iot/sim';
import { deviceStore, type Device } from './game/activeDevice.js';
import { connectedPad, padSnapshot } from './game/gamepad.js';
import { eventKeyFor, keyboardBinding } from './game/keyboard.js';
import { Palette } from './palette.js';
import { deviceNow, fitCanvasToWindow } from './render/cameras.js';
import { GameScene, type GameData } from './scenes/GameScene.js';
import { AccountScene } from './scenes/AccountScene.js';
import { ControlsScene } from './scenes/ControlsScene.js';
import { CreationScene } from './scenes/CreationScene.js';
import { GateScene } from './scenes/GateScene.js';
import { HoldingScene } from './scenes/HoldingScene.js';
import { InventoryScene } from './scenes/InventoryScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { SleepScene } from './scenes/SleepScene.js';
import { StartScene } from './scenes/StartScene.js';
import { TestScene } from './scenes/TestScene.js';
import { ToastScene, toastStore } from './ui/toasts.js';
import { askFullScreenOnFirstTouch, PortraitScene } from './ui/portrait.js';
import { buildStore } from './game/build.js';
import { tuningStore } from './game/tuningStore.js';
import { debugFlags } from './ui/debugFlags.js';
import { DebugOverlay } from './ui/debugOverlay.js';
import { TuningPanel } from './ui/tuningPanel.js';

const params = new URLSearchParams(window.location.search);

if (params.has('net')) {
  // M0 network smoke test (connects to the game server).
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: Palette.hollow,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [TestScene],
  });
} else {
  startGame();
}

function startGame(): void {
  // The canvas is the window: backing store in device px, CSS size the window (render/cameras.ts).
  // Each scene puts its cameras on whole device pixels per world or UI pixel (game/view.ts).
  const device = deviceNow();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: Palette.hollow,
    pixelArt: true,
    roundPixels: true,
    // Three touch pointers: two thumbs and one more (M2 Task 10, controls.md §6).
    input: { gamepad: false, activePointers: 3 },
    scale: { mode: Phaser.Scale.NONE, width: device.w, height: device.h, zoom: 1 / device.dpr },
    // The gate asks the server who is signed in (GET /api/me) and opens the
    // account, creation or start screen.
    scene: [
      GateScene,
      AccountScene,
      CreationScene,
      StartScene,
      HoldingScene,
      GameScene,
      ResultsScene,
      ControlsScene,
      InventoryScene,
      SleepScene,
      // Last, so the toast strip draws above everything, the inventory included (M2 Task 7).
      ToastScene,
      // Over all of them: the portrait line on a phone held upright (M2 Task 10).
      PortraitScene,
    ],
  });
  game.scene.start('portrait');
  // Also fires when the browser zoom (and so the device pixel ratio) changes.
  window.addEventListener('resize', () => {
    fitCanvasToWindow(game);
  });
  // A phone turned sideways can fire its resize (or orientationchange) while the window still reports the old,
  // upright size (iOS Safari), which left the canvas taller than the screen and the game pushed down (David's
  // playtest, 2026-10-21). The window's size is checked again every frame; the fit only acts on a change.
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    fitCanvasToWindow(game);
  });
  // Moving the window to a display with another pixel ratio may not resize it: watch the ratio too.
  const watchRatio = (): void => {
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        fitCanvasToWindow(game);
        watchRatio();
      },
      { once: true },
    );
  };
  watchRatio();

  // The active device (keyboard+mouse, gamepad or touch): any key or mouse button, mouse motion past a
  // few px, any pad button or stick, a finger on the screen. Everything that shows bindings follows it live.
  // Pointer events, so the mouse events a browser makes up after a tap never count as the mouse.
  // A key typed into a form input is the phone's own keyboard as often as a real one: it never changes the device.
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    deviceStore.key();
  });
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') deviceStore.touch();
      else if (e.pointerType === 'mouse') deviceStore.key();
    },
    true,
  );
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') deviceStore.mouseMove(e.movementX, e.movementY);
  });
  const parent = document.getElementById('game');
  if (parent) askFullScreenOnFirstTouch(parent);
  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    deviceStore.pad(padSnapshot(connectedPad()));
  });

  const panel = new TuningPanel();
  const debug = new DebugOverlay();
  const tuningKey = eventKeyFor(keyboardBinding('tuning'));
  const debugKey = eventKeyFor(keyboardBinding('debug'));
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === tuningKey.toLowerCase()) {
      e.preventDefault();
      panel.toggle();
    } else if (e.key.toLowerCase() === debugKey.toLowerCase()) {
      // F3: the stats overlay, and the old hitbox shapes drawn over the sprites.
      e.preventDefault();
      debug.toggle();
      debugFlags.shapes = !debugFlags.shapes;
    }
  });

  const activeGame = (): GameScene | null => {
    const scene = game.scene.getScene('game') as GameScene | null;
    return scene && game.scene.isActive('game') ? scene : null;
  };
  const activeHolding = (): HoldingScene | null => {
    const scene = game.scene.getScene('holding') as HoldingScene | null;
    return scene && (game.scene.isActive('holding') || game.scene.isPaused('holding')) ? scene : null;
  };
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    debug.update(activeGame(), game.loop.actualFps);
  });

  /** Hooks for headless playtests and debugging from the console. */
  const hooks = {
    game,
    scene: activeGame,
    /** Start a run; `rooms` keeps it to those templates of rooms.json, by name (screenshots of one room). */
    startRun(seed: number, weapon = 'hookblade', rooms?: string[]): void {
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      const data: GameData = rooms ? { seed, weapon, rooms } : { seed, weapon };
      game.scene.start('game', data);
    },
    /** The tile room at 1× (its pieces and doors as drawn now) as a PNG data URL, or null outside a run. */
    roomImage(): Promise<string | null> {
      return activeGame()?.world.tiles.snapshot() ?? Promise.resolve(null);
    },
    /** The tile room texture's size and its GPU target's, or null outside a run (playtests: --room-changes). */
    roomTextureSize() {
      return activeGame()?.world.tiles.textureSize() ?? null;
    },
    /** The tile room's door frames this render frame (empty outside a run). */
    doorFrames(): string[] {
      return activeGame()?.world.tiles.doorFrames() ?? [];
    },
    /** The chests' frames this render frame, in sim order (empty outside a run). */
    chestFrames(): string[] {
      return activeGame()?.world.chests.frames() ?? [];
    },
    /** What draws the Sparkglass pickups (`sheet` once prop-sparkglass is on disk, else `fallback`), and their frames this render frame. */
    pickups(): { renderer: 'sheet' | 'fallback'; frames: string[] } | null {
      const w = activeGame()?.world;
      return w ? { renderer: w.pickups.renderer, frames: w.pickups.frames() } : null;
    },
    setAutopilot(opts: AutopilotOptions | null): void {
      const s = activeGame();
      if (s) s.session.autopilot = opts;
    },
    /** Scripted input for playtests: a packed input per tick from the state (null restores the controls). */
    setInputSource(fn: ((state: RunState, params: Params) => number) | null): void {
      const s = activeGame();
      if (s) s.session.inputSource = fn;
    },
    /** Real-time pacing (1 = normal; 0.25 plays at quarter speed for screenshots). */
    setSpeed(speed: number): void {
      const s = activeGame();
      if (s) s.session.speed = Math.max(0, speed);
    },
    record(): RunRecord | null {
      return activeGame()?.session.run.record ?? null;
    },
    hash(): number | null {
      const s = activeGame();
      return s ? hashRunState(s.session.state) : null;
    },
    replayHash(record: RunRecord): number {
      return hashRunState(replayRun(record).state);
    },
    /** The Kindled's animation this frame (name, facing, frame), for playtests. */
    pose() {
      return activeGame()?.world.characters.pose ?? null;
    },
    /** The Husks' animations this frame, in sim order, for playtests. */
    huskPoses() {
      return activeGame()?.world.characters.huskPoses ?? [];
    },
    /** Swap the Kindled to another clay tone (a palette swap built at load). */
    setClayTone(tone: ClayTone): void {
      activeGame()?.world.characters.setTone(tone);
    },
    /** Draw the old hitbox shapes over the sprites (also toggled by F3 with the overlay). */
    setDebugShapes(on: boolean): void {
      debugFlags.shapes = on;
    },
    /** The holding scene (M2 Task 3b) as the playtests read it: the roam state, the pose, the server's answers, the panel; null outside it. */
    holding() {
      return activeHolding()?.snapshot() ?? null;
    },
    /** The holding scene itself (playtests: scripted roam input, the view frame). */
    holdingScene: activeHolding,
    /** The roam state's hash on the holding (the same inputs give the same hash). */
    roamHash(): number | null {
      return activeHolding()?.session.hash() ?? null;
    },
    /** The toasts showing (M2 Task 7), oldest first: the newest is the bottom line. */
    toasts() {
      return toastStore.snapshot();
    },
    /** The sleep screen while it shows (M2 Task 7): its line; null otherwise. */
    sleeping(): { line: string } | null {
      const scene = game.scene.getScene('sleep') as SleepScene | null;
      return scene && game.scene.isActive('sleep') ? { line: scene.line } : null;
    },
    /** The active device the hints and the reticle follow. */
    device(): Device {
      return deviceStore.get();
    },
    /** The client's build, the server's once /health answered, and the label the menus show (game/build.ts). */
    get build() {
      return buildStore.snapshot();
    },
    panel,
    debug,
    /** The live tuning (playtests set a value, say a slower toss for a screenshot, as the F2 panel would). */
    tuning: tuningStore,
  };
  (window as unknown as { __iot: typeof hooks }).__iot = hooks;
}
