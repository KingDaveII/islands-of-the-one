/**
 * The clay-tone palette swap on raw RGBA pixels (docs/design/sprites.md §5):
 * every opaque pixel whose colour is a key of `swaps` takes its value. With a
 * skin `mask` (a v2 Kindled sheet's `<name>.skin.png`, the same size) only
 * pixels under the mask's opaque pixels swap, because the clay ramp is shared
 * with wood, rope, belts and boots; without one (a v1 sheet) the whole sheet
 * swaps. The freckle colour is never a key, so it never swaps. Pure, so the
 * client tests it in node; spriteSheets.ts runs it over a canvas.
 */
export type Pixels = Uint8Array | Uint8ClampedArray;

/** Swap `pixels` in place; returns how many pixels changed. */
export function swapTone(pixels: Pixels, swaps: Readonly<Record<string, string>>, mask: Pixels | null = null): number {
  if (mask && mask.length !== pixels.length) throw new Error('the skin mask is not the size of the sheet');
  const table = new Map<number, number>();
  for (const [from, to] of Object.entries(swaps)) table.set(parseInt(from.slice(1), 16), parseInt(to.slice(1), 16));
  let changed = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) === 0) continue;
    if (mask && (mask[i + 3] ?? 0) === 0) continue;
    const to = table.get(((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0));
    if (to === undefined) continue;
    pixels[i] = (to >> 16) & 0xff;
    pixels[i + 1] = (to >> 8) & 0xff;
    pixels[i + 2] = to & 0xff;
    changed++;
  }
  return changed;
}
