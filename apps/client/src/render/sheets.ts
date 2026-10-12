import type Phaser from 'phaser';
import { controllerGlyphsSheet, hookbladeFxSheet, type CellSheet } from '@iot/shared';
import glyphsUrl from '@iot/shared/assets/controller-glyphs-12px.png';
import hookbladeUrl from '@iot/shared/assets/hookblade-fx.png';

/**
 * The engine's cell sheets (packages/shared/assets, white on transparent)
 * as Phaser textures with one frame per named cell. Call `preloadSheets` from
 * a scene's preload and `registerSheetFrames` from its create; both are safe
 * to call again from later scenes (textures are game-wide).
 */
export const GLYPH_TEXTURE = 'controller-glyphs';
export const HOOKBLADE_TEXTURE = 'hookblade-fx';

const SHEETS: [string, string, CellSheet][] = [
  [GLYPH_TEXTURE, glyphsUrl, controllerGlyphsSheet],
  [HOOKBLADE_TEXTURE, hookbladeUrl, hookbladeFxSheet],
];

export function preloadSheets(scene: Phaser.Scene): void {
  for (const [key, url] of SHEETS) if (!scene.textures.exists(key)) scene.load.image(key, url);
}

export function registerSheetFrames(scene: Phaser.Scene): void {
  for (const [key, , sheet] of SHEETS) {
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    for (const c of sheet.cells) if (!texture.has(c.name)) texture.add(c.name, 0, c.x, c.y, c.w, c.h);
  }
}
