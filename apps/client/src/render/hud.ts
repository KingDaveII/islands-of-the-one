import type Phaser from 'phaser';
import { lightStrike, playerAttackPhase, type Run } from '@iot/sim';
import { Palette } from '../palette.js';
import { pixelText, textWidth } from './pixelFont.js';

const W = 480;
const H = 270;

/**
 * Screen-space HUD: HP, dodge cooldown, light/heavy indicator with charge,
 * ability slots (1 active, 2-3 locked), room counter and Sparkglass.
 */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly room: Phaser.GameObjects.BitmapText;
  private readonly spark: Phaser.GameObjects.BitmapText;
  private readonly hp: Phaser.GameObjects.BitmapText;
  private readonly keys: Phaser.GameObjects.BitmapText[];
  private shownHp = -1;
  private lagHp = 0;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    this.g = scene.add.graphics();
    this.room = pixelText(scene, W - 6, 6, '', Palette.pearl).setOrigin(1, 0);
    this.spark = pixelText(scene, W - 6, 18, '', Palette.spark).setOrigin(1, 0);
    this.hp = pixelText(scene, 8, 6, '', Palette.white);
    const roll = pixelText(scene, 50, 16, 'DODGE', Palette.locked);
    const slotX = this.slotX();
    this.keys = [
      pixelText(scene, 0, 0, 'L', Palette.pearl),
      pixelText(scene, 0, 0, 'H', Palette.pearl),
      pixelText(scene, (slotX[0] ?? 0) + 2, H - 40, 'Q', Palette.pearl),
      pixelText(scene, (slotX[1] ?? 0) + 2, H - 40, 'R', Palette.locked),
      pixelText(scene, (slotX[2] ?? 0) + 2, H - 40, 'F', Palette.locked),
    ];
    layer.add([this.g, this.room, this.spark, this.hp, roll, ...this.keys]);
  }

  private slotX(): number[] {
    return [W / 2 + 14, W / 2 + 36, W / 2 + 58];
  }

  draw(run: Run, dtMs: number): void {
    const s = run.state;
    const P = run.params;
    const p = s.player;
    const g = this.g;
    g.clear();

    // HP with a lagging "damage taken" segment.
    if (this.shownHp < 0) this.lagHp = p.hp;
    this.shownHp = p.hp;
    this.lagHp = Math.max(p.hp, this.lagHp - (dtMs / 1000) * 40);
    const bw = 96;
    g.fillStyle(Palette.ink, 0.85).fillRect(5, 5, bw + 2, 10);
    g.fillStyle(Palette.hpBack, 1).fillRect(6, 6, bw, 8);
    g.fillStyle(Palette.white, 0.8).fillRect(6, 6, (bw * this.lagHp) / P.player.maxHp, 8);
    g.fillStyle(Palette.hpFill, 1).fillRect(6, 6, (bw * p.hp) / P.player.maxHp, 8);
    this.hp.setText(`${p.hp}`).setPosition(8 + bw, 6);

    // Dodge: full bar = ready.
    const ready = p.dodgeCooldown === 0 && p.action !== 'dodge';
    const cd = P.dodge.cooldown > 0 ? 1 - p.dodgeCooldown / P.dodge.cooldown : 1;
    g.fillStyle(Palette.ink, 0.85).fillRect(5, 17, 42, 5);
    g.fillStyle(ready ? Palette.sail : Palette.sailDark, 1).fillRect(6, 18, 40 * (p.action === 'dodge' ? 0 : cd), 3);

    // Room counter and Sparkglass.
    this.room.setText(`ROOM ${s.roomIndex + 1}/${P.run.rooms.length}`);
    this.spark.setText(`${s.sparkglass}`);
    const sx = W - 6 - textWidth(String(s.sparkglass)) - 7;
    g.fillStyle(Palette.sparkDeep, 1).fillTriangle(sx, 18, sx + 3, 22, sx - 3, 22).fillTriangle(sx, 26, sx + 3, 22, sx - 3, 22);
    g.fillStyle(Palette.spark, 1).fillRect(sx - 1, 20, 2, 3);

    // Light: combo pips (filled = steps done in this chain).
    const lx = W / 2 - 78;
    const ly = H - 22;
    this.panel(g, lx, ly - 8, 34, 18);
    this.keys[0]?.setPosition(lx + 3, ly - 6);
    const n = P.weapon.light.length;
    const doneSteps = p.action === 'light' ? p.comboStep + 1 : p.comboTimer > 0 ? p.nextCombo : 0;
    for (let i = 0; i < n; i++) {
      const filled = i < doneSteps;
      const big = i === n - 1;
      g.fillStyle(filled ? Palette.blade : Palette.locked, 1).fillRect(lx + 12 + i * 7, ly - (big ? 4 : 3), big ? 5 : 4, big ? 6 : 4);
    }
    const lph = playerAttackPhase(p, P);
    if (p.action === 'light' && lph === 'active') {
      const st = lightStrike(P, p.comboStep);
      g.lineStyle(1, Palette.white, 0.6).strokeRect(lx, ly - 8, 34, 18 + st.shake);
    }

    // Heavy: charge bar with notches.
    const hx = W / 2 - 40;
    this.panel(g, hx, ly - 8, 46, 18);
    this.keys[1]?.setPosition(hx + 3, ly - 6);
    const f = p.action === 'charge' || p.action === 'heavy' ? Math.min(1, p.charge / P.weapon.heavy.fullCharge) : 0;
    g.fillStyle(Palette.ink, 1).fillRect(hx + 12, ly - 3, 30, 5);
    g.fillStyle(f >= 1 ? Palette.spark : Palette.sail, 1).fillRect(hx + 12, ly - 3, 30 * f, 5);
    g.fillStyle(Palette.ink, 1).fillRect(hx + 22, ly - 3, 1, 5).fillRect(hx + 32, ly - 3, 1, 5);

    // Ability slots: 1 active (with cooldown), 2-3 locked.
    this.slotX().forEach((x, i) => {
      const slot = P.weapon.slots[i] ?? null;
      this.panel(g, x - 2, ly - 8, 18, 18);
      if (slot === null) {
        // Padlock.
        g.fillStyle(Palette.locked, 1).fillRect(x + 4, ly + 1, 7, 5);
        g.lineStyle(1, Palette.locked, 1).strokeRect(x + 5, ly - 2, 5, 4);
        return;
      }
      const cdTicks = p.cooldowns[i] ?? 0;
      const frac = P.lunge.cooldown > 0 ? cdTicks / P.lunge.cooldown : 0;
      // Lunge icon: arrow.
      g.fillStyle(cdTicks > 0 ? Palette.locked : Palette.blade, 1);
      g.fillRect(x + 3, ly, 7, 2).fillTriangle(x + 10, ly - 3, x + 14, ly + 1, x + 10, ly + 5);
      if (frac > 0) g.fillStyle(Palette.ink, 0.65).fillRect(x - 1, ly - 7, 16, 16 * frac);
    });
  }

  private panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(Palette.ink, 0.75).fillRect(x, y, w, h);
    g.lineStyle(1, Palette.wallEdge, 1).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}
