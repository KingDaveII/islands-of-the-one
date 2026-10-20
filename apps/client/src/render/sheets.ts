import type Phaser from 'phaser';
import { controllerGlyphsSheet, fieldGroundSheet, hookbladeFxSheet, itemIconsSheet, toastGlyphsSheet, touchGlyphsSheet, type CellSheet } from '@iot/shared';
import fieldGroundUrl from '@iot/shared/assets/field-ground-64px.png';
import glyphsUrl from '@iot/shared/assets/controller-glyphs-12px.png';
import hookbladeUrl from '@iot/shared/assets/hookblade-fx.png';
import itemIconsUrl from '@iot/shared/assets/item-icons-16px.png';
import toastGlyphsUrl from '@iot/shared/assets/toast-glyphs-12px.png';
import touchGlyphsUrl from '@iot/shared/assets/touch-glyphs-16px.png';

/**
 * The engine's cell sheets (packages/shared/assets, white on transparent)
 * as Phaser textures with one frame per named cell. Call `preloadSheets` from
 * a scene's preload and `registerSheetFrames` from its create; both are safe
 * to call again from later scenes (textures are game-wide).
 */
export const GLYPH_TEXTURE = 'controller-glyphs';
export const HOOKBLADE_TEXTURE = 'hookblade-fx';
/** ART's item icons (#77): a frame per item id, 16 px, in their own colours. */
export const ITEM_ICON_TEXTURE = 'item-icons';
/** ART's toast glyphs (#109, M2 Task 7): a frame per toast kind (a skill level per skill), 12 px, in their own colours. */
export const TOAST_GLYPH_TEXTURE = 'toast-glyphs';
/** ART's touch-control glyphs (#133, M2 Task 10): a frame per touch button (light, heavy, dodge, haul, gear, use), 16 px, in their own colours. */
export const TOUCH_GLYPH_TEXTURE = 'touch-glyphs';
/** ART's field ground (#123): a seamless 64 px frame per state (unsown, sown, faded), tiled inside a named plot, untinted. */
export const FIELD_GROUND_TEXTURE = 'field-ground';

const SHEETS: [string, string, CellSheet][] = [
  [GLYPH_TEXTURE, glyphsUrl, controllerGlyphsSheet],
  [HOOKBLADE_TEXTURE, hookbladeUrl, hookbladeFxSheet],
  [ITEM_ICON_TEXTURE, itemIconsUrl, itemIconsSheet],
  [TOAST_GLYPH_TEXTURE, toastGlyphsUrl, toastGlyphsSheet],
  [TOUCH_GLYPH_TEXTURE, touchGlyphsUrl, touchGlyphsSheet],
  [FIELD_GROUND_TEXTURE, fieldGroundUrl, fieldGroundSheet],
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
