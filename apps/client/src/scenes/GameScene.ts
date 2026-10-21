import Phaser from 'phaser';
import { roomTemplates } from '@iot/shared';
import { huskParams, SUB, TICK_HZ, TILE_PX, type RunResults, type SimEvent, type Tuning } from '@iot/sim';
import { Controls } from '../game/controls.js';
import { promptTarget } from '../game/interact.js';
import { Session } from '../game/session.js';
import { tuningStore } from '../game/tuningStore.js';
import { fitUi, fitWorldView, viewInUi, type Rect as ViewRect, type UiFit, type WorldFit } from '../game/view.js';
import { Palette } from '../palette.js';
import { Fx } from '../render/fx.js';
import { hintItems, HintRow } from '../render/hint.js';
import { Hud, type BodyRect, type Corner, type Rect } from '../render/hud.js';
import { clampScroll } from '../render/camera.js';
import { DEPTH } from '../render/depth.js';
import { simPx, worldPx } from '../render/scale.js';
import { preloadSheets, registerSheetFrames } from '../render/sheets.js';
import { preloadTileSheet } from '../render/roomTiles.js';
import { preloadSpriteSheets, registerSpriteSheets } from '../render/spriteSheets.js';
import { blinkOut, place, preloadFonts, registerFonts, worldWord, type Text } from '../render/text.js';
import { drawReticle, rad, WorldRenderer } from '../render/world.js';
import { TouchControls, type TouchButtonState } from '../ui/touchControls.js';
import type { TouchControlId } from '../game/touchLayout.js';

const END_DELAY_MS = 1900;
/** The room banner's line, UI px below the top of the world view (M1's 84 of 270). */
const BANNER_Y = 84;
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
  /** Playtests and screenshots only: run in these templates of rooms.json, by name (default: all of them). */
  rooms?: string[];
}

export class GameScene extends Phaser.Scene {
  session!: Session;
  controls!: Controls;
  world!: WorldRenderer;
  private fx!: Fx;
  private hud!: Hud;
  private worldLayer!: Phaser.GameObjects.Layer;
  private hudLayer!: Phaser.GameObjects.Layer;
  /** The UI camera (the main camera is the world's). */
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  /** The world view and the UI grid for the current canvas, and the view in UI px. */
  private worldFit: WorldFit = { zW: 1, w: 960, h: 540, x: 0, y: 0 };
  private uiFit: UiFit = { zU: 1, w: 480, h: 270 };
  private frame: ViewRect = { x: 0, y: 0, w: 480, h: 270 };
  private fitKey = '';
  /** The world camera's scroll this frame, whole world px (shake included). */
  private scroll = { x: 0, y: 0 };

  private banner!: Text;
  private bannerSub!: Text;
  private bannerLife = 0;
  private tint!: Phaser.GameObjects.Rectangle;
  /** The mouse reticle: the cursor in a run, on the UI grid at the pointer. */
  private cursor!: Phaser.GameObjects.Graphics;
  /** The interact prompt (Calm only) over the nearest interactable in reach; nothing in M1 needs one. */
  private prompt!: HintRow;
  private seed = 0;
  private weapon = 'hookblade';
  private rooms: string[] | undefined;
  /** The touch layer (M2 Task 10): the stick, LIGHT, HEAVY, DODGE, the Haul's arc, the item slots, USE and the gear. */
  touch!: TouchControls;
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
    this.rooms = data.rooms;
    this.endAt = -1;
    this.lastRoom = -1;
  }

  preload(): void {
    preloadSheets(this);
    preloadSpriteSheets(this);
    preloadTileSheet(this);
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
    // The pointer is read through the world camera, in sim px (aim, the reticle).
    this.controls = new Controls(this, (p) => {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      return { x: simPx(w.x), y: simPx(w.y) };
    });
    const rooms = this.rooms;
    const templates = rooms ? roomTemplates.filter((t) => rooms.includes(t.name)) : roomTemplates;
    this.session = new Session(this.seed, this.weapon, this.controls, templates.length ? templates : roomTemplates);
    this.world = new WorldRenderer(this, this.worldLayer, juice, () => tuningStore.get().anim);
    this.fx = new Fx(this, this.worldLayer, this.hudLayer, juice, (x, y) => this.toUi(x, y));
    // Words over the world are UI px, placed at their projected world position (readability.md §4).
    this.prompt = new HintRow(this, { backdrop: true }).setVisible(false);
    this.prompt.container.setDepth(DEPTH.prompt);
    this.hudLayer.add(this.prompt.container);
    // Slow-mo tint over the world view, under the HUD.
    this.tint = this.add.rectangle(0, 0, 1, 1, Palette.hollow, 0).setOrigin(0, 0);
    this.hudLayer.add(this.tint);
    const tuning: Tuning = tuningStore.get();
    const weaponName = tuning.weapons[this.weapon]?.name ?? this.weapon;
    this.hud = new Hud(this, this.hudLayer, this.session.run, weaponName, this.controls);

    // Words over the world: dark ink, no panel, no shadow (readability.md §4).
    this.banner = worldWord(this, 0, 0, '', 16).setVisible(false);
    this.bannerSub = worldWord(this, 0, 0, '').setVisible(false);
    this.hudLayer.add([this.banner, this.bannerSub]);
    this.cursor = this.add.graphics().setDepth(DEPTH.cursor);
    this.hudLayer.add(this.cursor);
    this.touch = new TouchControls(this, {
      mode: 'run',
      layer: this.hudLayer,
      uiZoom: () => this.uiFit.zU,
      avoid: () => Object.values(this.hud.panelRects()),
      abilities: this.session.run.params.weapon.abilities.length,
      // USE only while a prompt is up (Calm, a thing in reach).
      showing: (id) => id !== 'use' || this.prompt.container.visible,
      // A tap on a thing is Interact; on the ground of a run's room, nothing (tap to walk is the holding's).
      onTap: (x, y) => {
        this.tapAt(x, y);
      },
      onControl: (id) => {
        // The gear is the menu: a run has no pause yet, so it leaves for the start screen.
        if (id === 'gear') this.scene.start('start');
      },
      state: (id) => this.touchState(id),
    });
    this.controls.touch = this.touch.input;

    // Two cameras on two grids (game/view.ts): the world's (main) at zW, the UI's over it at zU.
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.worldLayer);
    this.cameras.main.ignore(this.hudLayer);
    this.cameras.main.setOrigin(0, 0);
    this.uiCam.setOrigin(0, 0);
    this.fitKey = '';
    this.fitCameras();
    this.input.setDefaultCursor('none');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.touch.destroy();
      this.session.dispose();
      this.controls.dispose();
      this.input.setDefaultCursor('default');
    });
  }

  /**
   * Fit the cameras to the canvas (every frame; it only acts on a change,
   * which a window resize or a browser zoom makes): the world camera on the
   * centred world view at zW, the UI camera over the whole canvas at zU, the
   * HUD on the view's edges in UI px.
   */
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
    this.tint.setPosition(this.frame.x, this.frame.y).setSize(this.frame.w, this.frame.h);
    if (this.banner.visible) this.placeBanner();
    return true;
  }

  /** A point of the world (sim px) on the UI grid (UI px, unrounded): through the world camera, then into UI px. */
  toUi(x: number, y: number): { x: number; y: number } {
    const w = this.worldFit;
    const z = this.uiFit.zU;
    return {
      x: (w.x + (worldPx(x) - this.scroll.x) * w.zW) / z,
      y: (w.y + (worldPx(y) - this.scroll.y) * w.zW) / z,
    };
  }

  /** The world view in UI px (playtests, the HUD). */
  viewFrame(): Readonly<ViewRect> {
    return this.frame;
  }

  /** The cameras' fits (playtests and screenshots read them). */
  fits(): { world: Readonly<WorldFit>; ui: Readonly<UiFit> } {
    return { world: this.worldFit, ui: this.uiFit };
  }

  private showBanner(text: string, sub = '', ms = 1400): void {
    this.banner.setText(text).setVisible(true);
    this.bannerSub.setText(sub).setVisible(sub !== '');
    this.placeBanner();
    this.bannerLife = ms;
  }

  /** The banner over the top of the view, centred (UI px). */
  private placeBanner(): void {
    const cx = this.frame.x + this.frame.w / 2;
    place(this.banner, cx, this.frame.y + BANNER_Y, 0.5);
    place(this.bannerSub, cx, this.frame.y + BANNER_Y + 22, 0.5);
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
            // The hit ring: the one 2 px ring (ART 2026-10-17).
            this.fx.ring(x, y, 4, 16, 260, Palette.shellCrack, 2);
            this.fx.float(x, y - 10, e.broke === 0 && P.husks[e.kind].shell.length > 1 ? 'CRACK' : 'BREAK', 600);
          }
          break;
        }
        case 'playerHurt':
          this.fx.shake(e.shake);
          this.fx.flash('p', j.hitFlashFrames);
          this.world.characters.hit('p');
          this.fx.burst(e.x / SUB, e.y / SUB, 10, Palette.hurt, j.particleSpeed, { dir: rad(e.dir), spread: 2 });
          this.fx.float(e.x / SUB, e.y / SUB - 14, `-${e.damage}`, 650, Palette.hurtInk);
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
          this.fx.float(p.x / SUB, p.y / SUB - 16, e.id.toUpperCase(), 700);
          this.fx.ring(p.x / SUB, p.y / SUB, 2, 12, 300, Palette.healthFill, 1);
          break;
        }
        case 'chestOpened':
          this.fx.burst(e.x / SUB, e.y / SUB - 4, 8, Palette.spark, 60, { dir: -Math.PI / 2, spread: 1.2, life: 400 });
          if (e.count > 0) this.fx.float(e.x / SUB, e.y / SUB - 14, `+${e.count} ${e.item.toUpperCase()}`, 900, Palette.spark);
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
          this.fx.ring(e.x / SUB, e.y / SUB, 4, 34, 420, Palette.spark, 1);
          this.fx.burst(e.x / SUB, e.y / SUB, 18, Palette.spark, j.particleSpeed * 1.2, { shape: 'plus' });
          this.fx.float(e.x / SUB, e.y / SUB - 16, `PERFECT +${e.bonus}`, 900, Palette.spark);
          break;
        case 'huskAttack':
          if (e.kind === 'nutshell') {
            const h = this.session.state.husks.find((x) => x.id === e.id);
            if (h) {
              const r = P.husks.nutshell.slamRadius / SUB;
              const cx = h.x / SUB + Math.cos(rad(h.attackDir)) * (P.husks.nutshell.slamOffset / SUB);
              const cy = h.y / SUB + Math.sin(rad(h.attackDir)) * (P.husks.nutshell.slamOffset / SUB);
              this.fx.ring(cx, cy, r * 0.4, r, 260, Palette.shellCrack, 1);
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

  /** What a touch button shows (M2 Task 10): a cooldown as the run HUD's slots (dodge, the abilities), a locked slot, an item and its count. */
  private touchState(id: TouchControlId): TouchButtonState {
    const s = this.session.state;
    const p = s.player;
    const P = this.session.run.params;
    if (id === 'dodge') {
      const cd = p.action === 'dodge' ? 0 : P.dodge.cooldown > 0 ? p.dodgeCooldown / P.dodge.cooldown : 0;
      return { cooldown: cd, seconds: p.dodgeCooldown > 0 ? Math.ceil(p.dodgeCooldown / TICK_HZ) : 0 };
    }
    const slot = id === 'ability1' ? 0 : id === 'ability2' ? 1 : id === 'ability3' ? 2 : -1;
    if (slot >= 0) {
      const a = P.weapon.abilities[slot];
      if (!a) return { locked: true };
      const cd = p.cooldowns[slot] ?? 0;
      return { locked: a.locked, cooldown: a.cooldown > 0 ? cd / a.cooldown : 0, seconds: cd > 0 ? Math.ceil(cd / TICK_HZ) : 0 };
    }
    if (id === 'item1' || id === 'item2') {
      const item = p.items[id === 'item1' ? 0 : 1];
      return { item: item ? { id: item.id, count: item.count } : null };
    }
    return {};
  }

  /** A tap on the world (UI px) in a run: Interact when it lands on the prompted thing (Calm); the ground does nothing. */
  private tapAt(x: number, y: number): void {
    const s = this.session.state;
    if (s.context !== 'calm' || !this.prompt.container.visible) return;
    const target = promptTarget(s, tuningStore.get().juice.promptRangePx * SUB);
    if (!target) return;
    const at = this.toUi(target.x / SUB, target.y / SUB);
    const reach = this.touch.layout.tapMove + 16;
    if (Math.hypot(at.x - x, at.y - y) <= reach) this.touch.input.pressInteract();
  }

  /**
   * The interact prompt: the interact glyph and the target's word over the
   * nearest interactable within reach, in Calm only (docs/design/controls.md).
   * Chests open on contact and never prompt; M1 has no interactable, so this
   * shows nothing yet.
   */
  private updatePrompt(): void {
    const s = this.session.state;
    // The range is a sim distance (sim units); only the drawing is in world and UI px.
    const target = promptTarget(s, tuningStore.get().juice.promptRangePx * SUB);
    if (!target) {
      this.prompt.setVisible(false);
      return;
    }
    const at = this.toUi(target.x / SUB, target.y / SUB - 12);
    this.prompt
      .setItems([...(this.controls.touchMode ? [] : hintItems(this.controls.hint('interact'))), { text: target.label }])
      .place(at.x, at.y, 0.5, 1)
      .setVisible(true);
  }

  /**
   * The camera follows the player (led toward the aim) and may scroll past
   * the room's edges by the HUD's safe margins (the corner panels' extents),
   * so a player standing in a room corner is always in the clear area. A
   * room that fits the area the HUD leaves free is centered in it. All in
   * world px, over the current view (sim px and `aimLeadPx` ×2; the margins
   * from UI px through the two zooms).
   */
  private followCamera(snap: boolean): void {
    const s = this.session.state;
    const j = tuningStore.get().juice;
    const view = this.worldFit;
    const p = this.session.lerp('p', s.player.x, s.player.y);
    const aim = rad(s.player.aim);
    const tx = worldPx(p.x + Math.cos(aim) * j.aimLeadPx) - view.w / 2;
    const ty = worldPx(p.y + Math.sin(aim) * j.aimLeadPx) - view.h / 2;
    const roomW = worldPx(s.room.cols * TILE_PX);
    const roomH = worldPx(s.room.rows * TILE_PX);
    const m = this.marginsInWorld();
    const cx = clampScroll(tx, roomW, view.w, m.left, m.right);
    const cy = clampScroll(ty, roomH, view.h, m.top, m.bottom);
    const k = snap ? 1 : j.cameraLerp;
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.scroll = {
      x: Math.round(this.camX) + this.fx.shakeOffset.x,
      y: Math.round(this.camY) + this.fx.shakeOffset.y,
    };
    this.cameras.main.setScroll(this.scroll.x, this.scroll.y);
  }

  /** The HUD's safe margins (UI px from the edges of the view's UI rectangle) as world px from the view's edges, rounded up. */
  private marginsInWorld(): { left: number; right: number; top: number; bottom: number } {
    const m = this.hud.safeMargins();
    const w = this.worldFit;
    const z = this.uiFit.zU;
    const f = this.frame;
    const right = w.x + w.w * w.zW;
    const bottom = w.y + w.h * w.zW;
    // Device px from the view's own edge to the panel's inner edge, then world px.
    const toWorld = (device: number): number => Math.max(0, Math.ceil(device / w.zW));
    return {
      left: toWorld((f.x + m.left) * z - w.x),
      right: toWorld(right - (f.x + f.w - m.right) * z),
      top: toWorld((f.y + m.top) * z - w.y),
      bottom: toWorld(bottom - (f.y + f.h - m.bottom) * z),
    };
  }

  /** The HUD's panel rectangles (playtests check what the camera keeps clear). */
  hudRects(): Readonly<Record<Corner, Rect>> {
    return this.hud.panelRects();
  }

  /** The mouse reticle where the pointer is (UI px: canvas px over zU); the pad's is drawn in the world. */
  private drawCursor(): void {
    this.cursor.clear();
    const reticle = this.controls.reticle();
    if (reticle?.kind !== 'mouse') return;
    const p = this.input.activePointer;
    drawReticle(this.cursor, p.x / this.uiFit.zU, p.y / this.uiFit.zU);
  }

  /** A box of the world (sim px) on the UI grid, its corners projected and rounded outwards. */
  private boxToUi(x: number, y: number, w: number, h: number): BodyRect {
    const a = this.toUi(x, y);
    const b = this.toUi(x + w, y + h);
    const x0 = Math.floor(a.x);
    const y0 = Math.floor(a.y);
    return { x: x0, y: y0, w: Math.ceil(b.x) - x0, h: Math.ceil(b.y) - y0 };
  }

  /** UI rectangles of the player and the awake hostiles (a HUD panel one is behind is dithered), through the projection. */
  private bodyRects(): BodyRect[] {
    const s = this.session.state;
    const rects: BodyRect[] = [];
    const p = this.session.lerp('p', s.player.x, s.player.y);
    rects.push(this.boxToUi(Math.round(p.x) - 8, Math.round(p.y) - 14, 16, 24));
    for (const h of s.husks) {
      if (h.action === 'spawn' || h.core <= 0) continue;
      const r = huskParams(this.session.run.params, h.kind).radius / SUB;
      const pos = this.session.lerp(`h${h.id}`, h.x, h.y);
      rects.push(this.boxToUi(Math.round(pos.x) - r - 2, Math.round(pos.y) - r - 4, 2 * r + 4, 2 * r + 6));
    }
    return rects;
  }

  override update(_time: number, delta: number): void {
    this.fps = this.game.loop.actualFps;
    const events = this.session.update(delta);
    this.onEvents(events);
    const s = this.session.state;
    const refit = this.fitCameras();
    this.followCamera(refit || this.lastRoom !== s.roomIndex);
    this.lastRoom = s.roomIndex;
    const scale = this.session.timeScale();
    this.tint.setFillStyle(Palette.hollow, scale < 1 ? 0.28 : 0);
    // World time slows with the perfect-dodge slow-mo and with the playtest pacing (`setSpeed`), so the
    // effects, corpses and trail keep step with the sim when a screenshot slows or freezes it.
    const dtWorld = delta * scale * this.session.speed;
    this.world.draw(this.session, this.fx, this.time.now, dtWorld, delta, this.controls.reticle());
    this.fx.update(dtWorld, delta);
    this.updatePrompt();
    this.drawCursor();
    this.hud.draw(this.session.run, delta, this.bodyRects());
    this.touch.update(delta);

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
