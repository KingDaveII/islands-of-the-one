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
import { InventoryScene } from './scenes/InventoryScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { StartScene } from './scenes/StartScene.js';
import { TestScene } from './scenes/TestScene.js';
import { buildStore } from './game/build.js';
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
    input: { gamepad: false },
    scale: { mode: Phaser.Scale.NONE, width: device.w, height: device.h, zoom: 1 / device.dpr },
    // The gate asks the server who is signed in (GET /api/me) and opens the
    // account, creation or start screen.
    scene: [
      GateScene,
      AccountScene,
      CreationScene,
      StartScene,
      GameScene,
      ResultsScene,
      ControlsScene,
      InventoryScene,
    ],
  });
  // Also fires when the browser zoom (and so the device pixel ratio) changes.
  window.addEventListener('resize', () => {
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

  // The active device (keyboard+mouse or gamepad): any key or mouse button, mouse motion past a
  // few px, any pad button or stick. Everything that shows bindings follows it live.
  window.addEventListener('keydown', () => {
    deviceStore.key();
  });
  window.addEventListener('mousedown', () => {
    deviceStore.key();
  });
  window.addEventListener('mousemove', (e) => {
    deviceStore.mouseMove(e.movementX, e.movementY);
  });
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
  };
  (window as unknown as { __iot: typeof hooks }).__iot = hooks;
}
