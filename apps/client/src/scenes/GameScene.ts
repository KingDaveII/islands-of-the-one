import Phaser from 'phaser';
import { huskParams, SUB, TILE_PX, type RunResults, type SimEvent, type Tuning } from '@iot/sim';
import { Controls } from '../game/controls.js';
import { promptTarget } from '../game/interact.js';
import { Session } from '../game/session.js';
import { tuningStore } from '../game/tuningStore.js';
import { Palette } from '../palette.js';
import { Fx } from '../render/fx.js';
import { hintItems, HintRow } from '../render/hint.js';
import { Hud, type BodyRect, type Corner, type Rect } from '../render/hud.js';
import { clampScroll } from '../render/camera.js';
import { DEPTH } from '../render/depth.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { preloadSpriteSheets, registerSpriteSheets } from '../render/spriteSheets.js';
import { blinkOut, label, place, preloadFonts, registerFonts, shadowed, type Shadowed } from '../render/text.js';
import { rad, WorldRenderer } from '../render/world.js';

export const VIEW_W = 480;
export const VIEW_H = 270;
const END_DELAY_MS = 1900;
/** The banner blinks out over its last 300 ms (no alpha fade: readability.md §4). */
const BANNER_BLINK_MS = 300;

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
  world!: WorldRenderer;
  private fx!: Fx;
  private hud!: Hud;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  private banner!: Shadowed;
  private bannerSub!: Shadowed;
  private bannerLife = 0;
  private tint!: Phaser.GameObjects.Rectangle;
  /** The interact prompt (Calm only) over the nearest interactable in reach; nothing in M1 needs one. */
  private prompt!: HintRow;
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

  preload(): void {
    preloadSheets(this);
    preloadSpriteSheets(this);
    preloadFonts(this);
  }

  create(): void {
    registerSheetFrames(this);
    registerSpriteSheets(this);
    registerFonts(this);
    this.cameras.main.setBackgroundColor(Palette.hollow);
    this.worldLayer = this.add.layer();
    this.hudLayer = this.add.layer();
    const juice = () => tuningStore.get().juice;
    this.controls = new Controls(this);
    this.session = new Session(this.seed, this.weapon, this.controls);
    this.world = new WorldRenderer(this, this.worldLayer, juice);
    this.fx = new Fx(this, this.worldLayer, juice);
    this.prompt = new HintRow(this, { backdrop: true }).setVisible(false);
    this.prompt.container.setDepth(DEPTH.prompt);
    this.worldLayer.add(this.prompt.container);
    // Slow-mo tint over the world, under the HUD.
    this.tint = this.add.rectangle(0, 0, VIEW_W, VIEW_H, Palette.hollow, 0).setOrigin(0, 0);
    this.hudLayer.add(this.tint);
    const tuning: Tuning = tuningStore.get();
    const weaponName = tuning.weapons[this.weapon]?.name ?? this.weapon;
    this.hud = new Hud(this, this.hudLayer, this.session.run, weaponName, this.controls);

    this.banner = shadowed(label(this, 0, 0, '', Palette.uiInk, 16)).setVisible(false);
    this.bannerSub = shadowed(label(this, 0, 0, '', Palette.uiInkMuted)).setVisible(false);
    this.hudLayer.add([this.banner, this.bannerSub]);

    const hudCam = this.cameras.add(0, 0, VIEW_W, VIEW_H);
    hudCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.hudLayer);
    this.input.setDefaultCursor('none');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.session.dispose();
      this.controls.dispose();
      this.input.setDefaultCursor('default');
    });
  }

  private showBanner(text: string, sub = '', ms = 1400): void {
    place(this.banner.setText(text).setVisible(true), VIEW_W / 2, 84, 0.5);
    place(this.bannerSub.setText(sub).setVisible(sub !== ''), VIEW_W / 2, 106, 0.5);
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
          // Hit flash: the struck target turns signal-hit white for 1-2 frames, then its hit frame for 100 ms.
          this.fx.flash(`h${e.id}`, j.hitFlashFrames);
          this.world.characters.hit(`h${e.id}`);
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
          this.world.characters.hit('p');
          this.fx.burst(e.x / SUB, e.y / SUB, 10, Palette.hurt, j.particleSpeed, { dir: rad(e.dir), spread: 2 });
          this.fx.float(e.x / SUB, e.y / SUB - 14, `-${e.damage}`, Palette.hurtInk, 650);
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
          this.world.characters.regrow(e.id);
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
          this.world.characters.huskDied(e.id, e.kind, e.x, e.y);
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

  /**
   * The interact prompt: the interact glyph and the target's word over the
   * nearest interactable within reach, in Calm only (docs/design/controls.md).
   * Chests open on contact and never prompt; M1 has no interactable, so this
   * shows nothing yet.
   */
  private updatePrompt(): void {
    const s = this.session.state;
    const target = promptTarget(s, tuningStore.get().juice.promptRangePx * SUB);
    if (!target) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt
      .setItems([...hintItems(this.controls.hint('interact')), { text: target.label }])
      .place(target.x / SUB, target.y / SUB - 12, 0.5, 1)
      .setVisible(true);
  }

  /**
   * The camera follows the player (led toward the aim) and may scroll past
   * the room's edges by the HUD's safe margins (the corner panels' extents),
   * so a player standing in a room corner is always in the clear area. A
   * room that fits the area the HUD leaves free is centered in it.
   */
  private followCamera(snap: boolean): void {
    const s = this.session.state;
    const j = tuningStore.get().juice;
    const p = this.session.lerp('p', s.player.x, s.player.y);
    const aim = rad(s.player.aim);
    const tx = p.x + Math.cos(aim) * j.aimLeadPx - VIEW_W / 2;
    const ty = p.y + Math.sin(aim) * j.aimLeadPx - VIEW_H / 2;
    const roomW = s.room.cols * TILE_PX;
    const roomH = s.room.rows * TILE_PX;
    const m = this.hud.safeMargins();
    const cx = clampScroll(tx, roomW, VIEW_W, m.left, m.right);
    const cy = clampScroll(ty, roomH, VIEW_H, m.top, m.bottom);
    const k = snap ? 1 : j.cameraLerp;
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.cameras.main.setScroll(Math.round(this.camX), Math.round(this.camY));
  }

  /** The HUD's panel rectangles (playtests check what the camera keeps clear). */
  hudRects(): Readonly<Record<Corner, Rect>> {
    return this.hud.panelRects();
  }

  /** Screen rectangles of the player and the awake hostiles (a HUD panel one is behind fades). */
  private bodyRects(): BodyRect[] {
    const s = this.session.state;
    const cam = this.cameras.main;
    const rects: BodyRect[] = [];
    const p = this.session.lerp('p', s.player.x, s.player.y);
    rects.push({ x: Math.round(p.x) - cam.scrollX - 8, y: Math.round(p.y) - cam.scrollY - 14, w: 16, h: 24 });
    for (const h of s.husks) {
      if (h.action === 'spawn' || h.core <= 0) continue;
      const r = huskParams(this.session.run.params, h.kind).radius / SUB;
      const pos = this.session.lerp(`h${h.id}`, h.x, h.y);
      rects.push({ x: Math.round(pos.x) - cam.scrollX - r - 2, y: Math.round(pos.y) - cam.scrollY - r - 4, w: 2 * r + 4, h: 2 * r + 6 });
    }
    return rects;
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
    this.world.draw(this.session, this.fx, this.time.now, delta * scale, delta, this.controls.reticle());
    this.fx.update(delta * scale, delta);
    this.updatePrompt();
    this.hud.draw(this.session.run, delta, this.bodyRects());

    if (this.bannerLife > 0) {
      this.bannerLife -= delta;
      blinkOut(this.banner, this.bannerLife, BANNER_BLINK_MS);
      if (this.bannerSub.text) blinkOut(this.bannerSub, this.bannerLife, BANNER_BLINK_MS);
    }
    if (this.endAt >= 0 && this.time.now >= this.endAt) {
      this.endAt = -1;
      const data: ResultsData = { seed: this.seed, weapon: this.weapon, results: this.session.results() };
      this.scene.start('results', data);
    }
  }
}
