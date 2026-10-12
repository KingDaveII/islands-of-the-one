import Phaser from 'phaser';
import { SUB, TILE_PX, type RunResults, type SimEvent, type Tuning } from '@iot/sim';
import { Controls } from '../game/controls.js';
import { Session } from '../game/session.js';
import { tuningStore } from '../game/tuningStore.js';
import { Palette } from '../palette.js';
import { Fx } from '../render/fx.js';
import { Hud } from '../render/hud.js';
import { label, place, withShadow } from '../render/text.js';
import { rad, WorldRenderer } from '../render/world.js';

export const VIEW_W = 480;
export const VIEW_H = 270;
const END_DELAY_MS = 1900;

export interface ResultsData {
  seed: number;
  weapon: string;
  results: RunResults;
}

export interface GameData {
  seed: number;
  /** One weapon per run, picked on the start screen. */
  weapon: string;
}

export class GameScene extends Phaser.Scene {
  session!: Session;
  controls!: Controls;
  private world!: WorldRenderer;
  private fx!: Fx;
  private hud!: Hud;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private banner!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private bannerLife = 0;
  private tint!: Phaser.GameObjects.Rectangle;
  private seed = 0;
  private weapon = 'hookblade';
  private endAt = -1;
  private camX = 0;
  private camY = 0;
  private lastRoom = -1;
  fps = 0;

  constructor() {
    super('game');
  }

  init(data: GameData): void {
    this.seed = data.seed;
    this.weapon = data.weapon;
    this.endAt = -1;
    this.lastRoom = -1;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    const juice = () => tuningStore.get().juice;
    this.controls = new Controls(this);
    this.session = new Session(this.seed, this.weapon, this.controls);
    this.world = new WorldRenderer(this, this.worldLayer, juice);
    this.fx = new Fx(this, this.worldLayer, juice);
    // Slow-mo tint over the world, under the HUD.
    this.tint = this.add.rectangle(0, 0, VIEW_W, VIEW_H, Palette.hollow, 0).setOrigin(0, 0);
    this.hudLayer.add(this.tint);
    const tuning: Tuning = tuningStore.get();
    const weaponName = tuning.weapons[this.weapon]?.name ?? this.weapon;
    this.hud = new Hud(this, this.hudLayer, this.session.run, weaponName, this.controls);

    this.banner = withShadow(label(this, 0, 0, '', Palette.uiInk, 16)).setAlpha(0);
    this.bannerSub = withShadow(label(this, 0, 0, '', Palette.uiInkMuted)).setAlpha(0);
    this.hudLayer.add([this.banner, this.bannerSub]);

    const hudCam = this.cameras.add(0, 0, VIEW_W, VIEW_H);
    hudCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.hudLayer);
    this.input.setDefaultCursor('none');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.session.dispose();
      this.input.setDefaultCursor('default');
    });
  }

  private showBanner(text: string, sub = '', ms = 1400): void {
    place(this.banner.setText(text).setAlpha(1), VIEW_W / 2, 84, 0.5);
    place(this.bannerSub.setText(sub).setAlpha(sub ? 1 : 0), VIEW_W / 2, 106, 0.5);
    this.bannerLife = ms;
  }

  private onEvents(events: SimEvent[]): void {
    const j = tuningStore.get().juice;
    const P = this.session.run.params;
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const x = e.x / SUB;
          const y = e.y / SUB;
          this.fx.shake(e.shake);
          // Hit flash: the struck target turns signal-hit white for 1-2 frames.
          this.fx.flash(`h${e.id}`, j.hitFlashFrames);
          this.fx.chips(x, y, rad(e.dir), e.shell ? Math.ceil(j.chipParticles / 2) : j.chipParticles);
          if (e.shell) this.fx.burst(x, y, 3, Palette.shell, j.particleSpeed * 1.5, { dir: rad(e.dir) + Math.PI, spread: 1.4, life: 160 });
          if (e.broke >= 0) {
            this.fx.chips(x, y, rad(e.dir), j.shellBreakParticles);
            this.fx.ring(x, y, 4, 16, 260, Palette.shellCrack, 1);
            this.fx.float(x, y - 10, e.broke === 0 && P.husks[e.kind].shell.length > 1 ? 'CRACK' : 'BREAK', Palette.uiInk, 600);
          }
          break;
        }
        case 'playerHurt':
          this.fx.shake(e.shake);
          this.fx.flash('p', j.hitFlashFrames);
          this.fx.burst(e.x / SUB, e.y / SUB, 10, Palette.hurt, j.particleSpeed, { dir: rad(e.dir), spread: 2 });
          this.fx.float(e.x / SUB, e.y / SUB - 14, `-${e.damage}`, Palette.healthLoss, 650);
          if (e.armored) this.fx.ring(e.x / SUB, e.y / SUB - 4, 6, 12, 200, Palette.uiBevel, 1);
          break;
        case 'held': {
          // Pinned on the hook: a tight ring that snaps shut around the husk.
          const h = this.session.state.husks.find((x) => x.id === e.id);
          if (h) this.fx.ring(h.x / SUB, h.y / SUB, 10, 3, e.ms, Palette.blade, 1);
          break;
        }
        case 'haulHit':
          this.fx.shake(e.pull === 'player' ? 2 : 1);
          this.fx.burst(e.x / SUB, e.y / SUB, 4, Palette.blade, 60, { life: 200 });
          break;
        case 'haulMiss':
          this.fx.burst(e.x / SUB, e.y / SUB, 3, Palette.floorEdge, 30, { life: 180 });
          break;
        case 'itemUsed': {
          const p = this.session.state.player;
          this.fx.float(p.x / SUB, p.y / SUB - 16, e.id.toUpperCase(), Palette.healthFill, 700);
          this.fx.ring(p.x / SUB, p.y / SUB, 2, 12, 300, Palette.healthFill, 1);
          break;
        }
        case 'chestOpened':
          this.fx.burst(e.x / SUB, e.y / SUB - 4, 8, Palette.spark, 60, { dir: -Math.PI / 2, spread: 1.2, life: 400 });
          if (e.count > 0) this.fx.float(e.x / SUB, e.y / SUB - 14, `+${e.count} ${e.item.toUpperCase()}`, Palette.spark, 900);
          break;
        case 'shellRegrow': {
          const h = this.session.state.husks.find((x) => x.id === e.id);
          if (h) this.fx.ring(h.x / SUB, h.y / SUB, 2, 10, 260, Palette.shell, 1);
          break;
        }
        case 'dodge':
          this.fx.burst(e.x / SUB, e.y / SUB + 5, 5, Palette.floorEdge, 40, { dir: rad(e.dir) + Math.PI, spread: 1.6, life: 260 });
          break;
        case 'perfectDodge':
          this.world.perfectDodge();
          this.fx.ring(e.x / SUB, e.y / SUB, 4, 34, 420, Palette.spark, 2);
          this.fx.burst(e.x / SUB, e.y / SUB, 18, Palette.spark, j.particleSpeed * 1.2, { size: 2 });
          this.fx.float(e.x / SUB, e.y / SUB - 16, `PERFECT +${e.bonus}`, Palette.spark, 900);
          break;
        case 'huskAttack':
          if (e.kind === 'nutshell') {
            const h = this.session.state.husks.find((x) => x.id === e.id);
            if (h) {
              const r = P.husks.nutshell.slamRadius / SUB;
              const cx = h.x / SUB + Math.cos(rad(h.attackDir)) * (P.husks.nutshell.slamOffset / SUB);
              const cy = h.y / SUB + Math.sin(rad(h.attackDir)) * (P.husks.nutshell.slamOffset / SUB);
              this.fx.ring(cx, cy, r * 0.4, r, 260, Palette.shellCrack, 2);
              this.fx.burst(cx, cy, 10, Palette.floorEdge, 70, { life: 300 });
              this.fx.shake(2);
            }
          }
          break;
        case 'huskDeath':
          this.fx.coreFlare(e.x / SUB, e.y / SUB);
          this.fx.shake(e.kind === 'nutshell' ? 5 : 2);
          break;
        case 'spawn':
          this.fx.ring(e.x / SUB, e.y / SUB, 14, 2, 400, Palette.floorEdge, 1);
          break;
        case 'pickup':
          this.fx.burst(e.x / SUB, e.y / SUB, 4, Palette.spark, 50, { life: 220 });
          break;
        case 'roomEnter':
          this.showBanner(`ROOM ${e.index + 1}/${P.run.rooms.length}`);
          break;
        case 'roomCleared':
          if (e.index < P.run.rooms.length - 1) this.showBanner('CLEARED', 'THE DOOR IS OPEN');
          break;
        case 'runEnd':
          this.showBanner(e.status === 'cleared' ? 'SHARD CLEARED' : 'YOU FELL', '', END_DELAY_MS);
          this.endAt = this.time.now + END_DELAY_MS;
          break;
        default:
          break;
      }
    }
  }

  private followCamera(snap: boolean): void {
    const s = this.session.state;
    const j = tuningStore.get().juice;
    const p = this.session.lerp('p', s.player.x, s.player.y);
    const aim = rad(s.player.aim);
    const tx = p.x + Math.cos(aim) * j.aimLeadPx - VIEW_W / 2;
    const ty = p.y + Math.sin(aim) * j.aimLeadPx - VIEW_H / 2;
    const roomW = s.room.cols * TILE_PX;
    const roomH = s.room.rows * TILE_PX;
    const clampAxis = (v: number, size: number, view: number) =>
      size <= view ? (size - view) / 2 : Math.max(0, Math.min(size - view, v));
    const cx = clampAxis(tx, roomW, VIEW_W);
    const cy = clampAxis(ty, roomH, VIEW_H);
    const k = snap ? 1 : j.cameraLerp;
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
  }

  override update(_time: number, delta: number): void {
    this.fps = this.game.loop.actualFps;
    const events = this.session.update(delta);
    this.onEvents(events);
    const s = this.session.state;
    this.followCamera(this.lastRoom !== s.roomIndex);
    this.lastRoom = s.roomIndex;
    const scale = this.session.timeScale();
    this.tint.setFillStyle(Palette.hollow, scale < 1 ? 0.28 : 0);
    this.world.draw(this.session, this.fx, this.time.now, delta * scale, this.controls.crosshair());
    this.fx.update(delta * scale, delta);
    this.hud.draw(this.session.run, delta);

    if (this.bannerLife > 0) {
      this.bannerLife -= delta;
      const a = Math.min(1, this.bannerLife / 300);
      this.banner.setAlpha(a);
      if (this.bannerSub.text) this.bannerSub.setAlpha(a);
    }
    if (this.endAt >= 0 && this.time.now >= this.endAt) {
      this.endAt = -1;
      const data: ResultsData = { seed: this.seed, weapon: this.weapon, results: this.session.results() };
      this.scene.start('results', data);
    }
  }
}
