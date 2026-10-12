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
import { eventKeyFor, keyboardBinding } from './game/keyboard.js';
import { Palette } from './palette.js';
import { loadFonts } from './render/text.js';
import { GameScene, VIEW_H, VIEW_W, type GameData } from './scenes/GameScene.js';
import { ControlsScene } from './scenes/ControlsScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { StartScene } from './scenes/StartScene.js';
import { TestScene } from './scenes/TestScene.js';
import { debugFlags } from './ui/debugFlags.js';
import { DebugOverlay } from './ui/debugOverlay.js';
import { TuningPanel } from './ui/tuningPanel.js';

/** Largest integer zoom that fits (x4 on a 1080p screen), never below 1. */
function fitZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
}

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
  // Text uses the self-hosted pixel fonts, so they must be ready before any scene draws.
  void loadFonts().then(startGame, startGame);
}

function startGame(): void {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: Palette.hollow,
    pixelArt: true,
    roundPixels: true,
    input: { gamepad: false },
    scale: { mode: Phaser.Scale.NONE, width: VIEW_W, height: VIEW_H, zoom: fitZoom() },
    scene: [StartScene, GameScene, ResultsScene, ControlsScene],
  });
  window.addEventListener('resize', () => {
    game.scale.setZoom(fitZoom());
  });

  const panel = new TuningPanel();
  const debug = new DebugOverlay();
  const tuningKey = eventKeyFor(keyboardBinding('tuning'));
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === tuningKey.toLowerCase()) {
      e.preventDefault();
      panel.toggle();
    } else if (e.key === 'F3') {
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
    startRun(seed: number, weapon = 'hookblade'): void {
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      const data: GameData = { seed, weapon };
      game.scene.start('game', data);
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
    /** Swap the Kindled to another clay tone (a palette swap built at load). */
    setClayTone(tone: ClayTone): void {
      activeGame()?.world.characters.setTone(tone);
    },
    /** Draw the old hitbox shapes over the sprites (also toggled by F3 with the overlay). */
    setDebugShapes(on: boolean): void {
      debugFlags.shapes = on;
    },
    panel,
    debug,
  };
  (window as unknown as { __iot: typeof hooks }).__iot = hooks;
}
