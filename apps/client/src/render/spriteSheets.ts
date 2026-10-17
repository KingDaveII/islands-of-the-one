import type Phaser from 'phaser';
import {
  OPTIONAL_SPRITE_SHEETS,
  SPRITE_SHEET_NAMES,
  spriteSheets,
  type ClayTone,
  type SpriteSheet,
  type SpriteSheetName,
} from '@iot/shared';
import { swapTone } from './toneSwap.js';

/**
 * The sprite sheets (packages/shared/assets/sprites: the Kindled, the Husks,
 * the chest) as Phaser atlases (docs/design/sprites.md §8):
 * `preloadSpriteSheets` from a scene's preload loads each PNG with its JSON
 * Hash contract (the frames' `anchor` becomes the sprite origin) and, for a
 * Kindled sheet, its skin mask; a PNG that is not there is an error.
 * `registerSpriteSheets` from create builds one Phaser animation per entry of
 * the JSON `anims` block, named `<key>/<anim>`. Both are safe to repeat from
 * later scenes. Every sheet draws at 1 world px per sheet px (the v2
 * contract; the sheet test holds `meta.pixelScale` at 1).
 *
 * Optional sheets (`OPTIONAL_SPRITE_SHEETS`: the Sparkglass pickup's
 * `prop-sparkglass`) are bundled the same way when their JSON is on disk at
 * build time (`optionalSheet`) and loaded with the others; absent, the
 * engine keeps its fallback drawing (pickupSprites.ts, world.ts).
 *
 * Clay tones are built lazily (`toneTextureKey`): the first time a tone is
 * used, its texture is the drawn sheet's pixels with `palette.swaps[tone]`
 * applied under the skin mask, registered as the same atlas under
 * `<key>@<tone>` with its own `<key>@<tone>/<anim>` animations, and cached
 * game-wide.
 */

/** Every PNG next to the sheets, by file name: the sheets and their skin masks. */
const PNG_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../../packages/shared/assets/sprites/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

/** The URL of a PNG in packages/shared/assets/sprites (a sheet or a skin mask), if it exists. */
export function spritePngUrl(file: string): string | undefined {
  return PNG_URLS[file];
}

/** Every prop sheet JSON next to the sheets, by sheet name, as bundled at build time (the optional sheets are found here). */
const PROP_JSON: Record<string, unknown> = Object.fromEntries(
  Object.entries(
    import.meta.glob<unknown>('../../../../packages/shared/assets/sprites/prop-*.json', { eager: true, import: 'default' }),
  ).map(([path, json]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), json]),
);

/** Whether a bundled JSON has the shape of a sprite sheet (frames, meta with an image, anims). */
function isSpriteSheet(v: unknown): v is SpriteSheet {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const meta = o.meta as Record<string, unknown> | undefined;
  return typeof o.frames === 'object' && typeof o.anims === 'object' && typeof meta?.image === 'string';
}

/**
 * An optional sheet (`OPTIONAL_SPRITE_SHEETS`) if it was on disk when the
 * client was built, with its PNG; undefined otherwise, when the engine draws
 * its fallback. Any other name is undefined.
 */
export function optionalSheet(name: string): SpriteSheet | undefined {
  if (!OPTIONAL_SPRITE_SHEETS.includes(name)) return undefined;
  const json = PROP_JSON[name];
  if (!isSpriteSheet(json) || !spritePngUrl(json.meta.image)) return undefined;
  return json;
}

/** The optional sheets present at build time, by name. */
function optionalSheets(): [string, SpriteSheet][] {
  return OPTIONAL_SPRITE_SHEETS.flatMap((name) => {
    const sheet = optionalSheet(name);
    return sheet ? [[name, sheet]] : [];
  });
}

/** Texture key of a sheet's skin mask. */
const maskKey = (name: SpriteSheetName): string => `${name}.skin`;

/** Phaser animation key for a sheet animation: `<textureKey>/<anim>`. */
export function animKey(textureKey: string, anim: string): string {
  return `${textureKey}/${anim}`;
}

export function preloadSpriteSheets(scene: Phaser.Scene): void {
  for (const name of SPRITE_SHEET_NAMES) {
    const sheet = spriteSheets[name];
    const url = spritePngUrl(sheet.meta.image);
    if (!url) throw new Error(`no PNG for the ${name} sheet`);
    // The JSON contract is bundled with the code; Phaser takes it in place of a URL.
    if (!scene.textures.exists(name)) scene.load.atlas(name, url, sheet);
    const mask = sheet.palette?.mask;
    if (!mask || scene.textures.exists(maskKey(name))) continue;
    const maskUrl = spritePngUrl(mask);
    if (!maskUrl) throw new Error(`no skin mask ${mask} for the ${name} sheet`);
    scene.load.image(maskKey(name), maskUrl);
  }
  for (const [name, sheet] of optionalSheets()) {
    const url = spritePngUrl(sheet.meta.image);
    if (url && !scene.textures.exists(name)) scene.load.atlas(name, url, sheet);
  }
}

export function registerSpriteSheets(scene: Phaser.Scene): void {
  for (const name of SPRITE_SHEET_NAMES) {
    if (scene.textures.exists(name)) createAnims(scene, name, spriteSheets[name]);
  }
  for (const [name, sheet] of optionalSheets()) {
    if (scene.textures.exists(name)) createAnims(scene, name, sheet);
  }
}

/**
 * Texture key of a sheet in a clay tone: the sheet's own key for the drawn
 * tone (or a sheet without tones), else `<name>@<tone>`, built on first use
 * and cached. Falls back to the drawn sheet when the tone can't be built.
 */
export function toneTextureKey(scene: Phaser.Scene, name: SpriteSheetName, tone: ClayTone): string {
  const sheet = spriteSheets[name];
  const swaps = sheet.palette?.swaps[tone];
  if (!sheet.palette || tone === sheet.palette.drawn || !swaps) return name;
  const key = `${name}@${tone}`;
  if (scene.textures.exists(key)) return key;
  if (!scene.textures.exists(name)) return name;
  const canvas = swappedCanvas(scene, name, swaps, maskKey(name));
  if (!canvas) return name;
  // The swapped sheet is the same atlas over a recoloured copy of the pixels.
  scene.textures.addAtlasJSONHash(key, canvas as unknown as HTMLImageElement, sheet);
  createAnims(scene, key, sheet);
  return key;
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

/** A loaded texture's RGBA pixels (null without a 2D context or an image, as in tests): the prop shadows read the sheets once. */
export function texturePixels(scene: Phaser.Scene, key: string): ImageData | null {
  if (!scene.textures.exists(key)) return null;
  return pixelsOf(scene, key)?.image ?? null;
}

/** A texture's pixels, on a canvas of their own (null without a 2D context or an image). */
function pixelsOf(scene: Phaser.Scene, key: string): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; image: ImageData } | null {
  const source = scene.textures.get(key).getSourceImage();
  if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0);
  return { canvas, ctx, image: ctx.getImageData(0, 0, canvas.width, canvas.height) };
}

/** A copy of a loaded sheet's pixels with the swap applied under the mask, on a canvas. */
function swappedCanvas(scene: Phaser.Scene, name: string, swaps: Record<string, string>, mask: string): HTMLCanvasElement | null {
  const sheet = pixelsOf(scene, name);
  if (!sheet) return null;
  const m = scene.textures.exists(mask) ? pixelsOf(scene, mask) : null;
  // A sheet without its mask would recolour belts and boots: keep the drawn tone instead.
  if (!m || m.image.data.length !== sheet.image.data.length) return null;
  swapTone(sheet.image.data, swaps, m.image.data);
  sheet.ctx.putImageData(sheet.image, 0, 0);
  return sheet.canvas;
}
