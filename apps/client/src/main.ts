import Phaser from 'phaser';
import { replayRun, hashRunState, type AutopilotOptions, type RunRecord } from '@iot/sim';
import { Palette } from './palette.js';
import { GameScene, VIEW_H, VIEW_W } from './scenes/GameScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { StartScene } from './scenes/StartScene.js';
import { TestScene } from './scenes/TestScene.js';
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
    backgroundColor: '#0b1d2a',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [TestScene],
  });
} else {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: Palette.void,
    pixelArt: true,
    roundPixels: true,
    input: { gamepad: false },
    scale: { mode: Phaser.Scale.NONE, width: VIEW_W, height: VIEW_H, zoom: fitZoom() },
    scene: [StartScene, GameScene, ResultsScene],
  });
  window.addEventListener('resize', () => {
    game.scale.setZoom(fitZoom());
  });

  const panel = new TuningPanel();
  const debug = new DebugOverlay();
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      panel.toggle();
    } else if (e.key === 'F3') {
      e.preventDefault();
      debug.toggle();
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
    startRun(seed: number): void {
      game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
      game.scene.start('game', { seed });
    },
    setAutopilot(opts: AutopilotOptions | null): void {
      const s = activeGame();
      if (s) s.session.autopilot = opts;
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
    panel,
    debug,
  };
  (window as unknown as { __iot: typeof hooks }).__iot = hooks;
}
