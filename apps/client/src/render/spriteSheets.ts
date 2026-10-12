import type Phaser from 'phaser';
import {
  CLAY_TONES,
  SPRITE_SHEET_NAMES,
  spriteSheets,
  type ClayTone,
  type SpriteSheet,
  type SpriteSheetName,
} from '@iot/shared';
import huskNutshellUrl from '@iot/shared/assets/sprites/husk-nutshell.png';
import huskPeelingUrl from '@iot/shared/assets/sprites/husk-peeling.png';
import kindledAshUrl from '@iot/shared/assets/sprites/kindled-ash.png';

/**
 * The animated character sheets (packages/shared/assets/sprites) as Phaser
 * atlases (docs/design/sprites.md, "Engine"): `preloadSpriteSheets` from a
 * scene's preload loads each PNG with its JSON Hash contract (the frames'
 * `anchor` becomes the sprite origin); `registerSpriteSheets` from create
 * builds one Phaser animation per entry of the JSON `anims` block, named
 * `<key>/<anim>`, and the palette-swapped textures of the Kindled sheets:
 * one texture per clay tone from the `palette.swaps` block, built once from
 * the drawn sheet's pixels and cached game-wide, with its own animations
 * under `<key>@<tone>/<anim>`. Both calls are safe to repeat from later scenes.
 */
const URLS: Record<SpriteSheetName, string> = {
  'kindled-ash': kindledAshUrl,
  'husk-peeling': huskPeelingUrl,
  'husk-nutshell': huskNutshellUrl,
};

/** Texture key of a sheet in a clay tone: the sheet's own key for the drawn tone. */
export function toneTextureKey(name: SpriteSheetName, tone: ClayTone): string {
  const sheet = spriteSheets[name];
  return !sheet.palette || tone === sheet.palette.drawn ? name : `${name}@${tone}`;
}

/** Phaser animation key for a sheet animation: `<textureKey>/<anim>`. */
export function animKey(textureKey: string, anim: string): string {
  return `${textureKey}/${anim}`;
}

export function preloadSpriteSheets(scene: Phaser.Scene): void {
  for (const name of SPRITE_SHEET_NAMES) {
    if (scene.textures.exists(name)) continue;
    // The JSON contract is bundled with the code; Phaser takes it in place of a URL.
    scene.load.atlas(name, URLS[name], spriteSheets[name]);
  }
}

export function registerSpriteSheets(scene: Phaser.Scene): void {
  for (const name of SPRITE_SHEET_NAMES) {
    if (!scene.textures.exists(name)) continue;
    const sheet = spriteSheets[name];
    createAnims(scene, name, sheet);
    if (!sheet.palette) continue;
    for (const tone of CLAY_TONES) {
      const key = toneTextureKey(name, tone);
      if (key === name || scene.textures.exists(key)) continue;
      const swaps = sheet.palette.swaps[tone];
      if (!swaps) continue;
      const canvas = swappedCanvas(scene, name, swaps);
      if (!canvas) continue;
      // The swapped sheet is the same atlas over a recoloured copy of the pixels.
      scene.textures.addAtlasJSONHash(key, canvas as unknown as HTMLImageElement, sheet);
      createAnims(scene, key, sheet);
    }
  }
}

function createAnims(scene: Phaser.Scene, textureKey: string, sheet: SpriteSheet): void {
  for (const [anim, def] of Object.entries(sheet.anims)) {
    const key = animKey(textureKey, anim);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: def.frames.map((frame) => ({ key: textureKey, frame })),
      frameRate: Math.max(1, def.frameRate),
      repeat: def.repeat,
      // `hold`: a one-shot animation keeps its last frame; Phaser does that unless the sprite is told otherwise.
    });
  }
}

/** The hex colour of a pixel's RGB, lowercase, as the swaps block spells it. */
const hexOf = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** A copy of a loaded sheet's pixels with the swap applied, on a canvas (null without a 2D context). */
function swappedCanvas(
  scene: Phaser.Scene,
  name: string,
  swaps: Record<string, string>,
): HTMLCanvasElement | null {
  const source = scene.textures.get(name).getSourceImage();
  if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const table = new Map<string, [number, number, number]>();
  for (const [from, to] of Object.entries(swaps)) {
    const v = parseInt(to.slice(1), 16);
    table.set(from.toLowerCase(), [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  }
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i + 3] ?? 0) === 0) continue;
    const to = table.get(hexOf(d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0));
    if (!to) continue;
    [d[i], d[i + 1], d[i + 2]] = to;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
