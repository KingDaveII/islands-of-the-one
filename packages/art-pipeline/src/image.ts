/** A straight-alpha RGBA image, row-major, 4 bytes per pixel. */
export interface Img {
  w: number;
  h: number;
  data: Uint8Array;
}

export function blank(w: number, h: number): Img {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

export function cloneImg(img: Img): Img {
  return { w: img.w, h: img.h, data: img.data.slice() };
}

export function alphaAt(img: Img, x: number, y: number): number {
  return img.data[(y * img.w + x) * 4 + 3] ?? 0;
}

export function opaqueAt(img: Img, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < img.w && y < img.h && alphaAt(img, x, y) !== 0;
}

/** The colour of a pixel as "#rrggbb", lowercase. */
export function hexAt(img: Img, x: number, y: number): string {
  const i = (y * img.w + x) * 4;
  return `#${(((img.data[i] ?? 0) << 16) | ((img.data[i + 1] ?? 0) << 8) | (img.data[i + 2] ?? 0)).toString(16).padStart(6, '0')}`;
}

/** Sets a pixel to an opaque "#rrggbb" colour, or to transparent (all zero) for null. */
export function setPixel(img: Img, x: number, y: number, hex: string | null): void {
  const i = (y * img.w + x) * 4;
  if (hex === null) {
    img.data.fill(0, i, i + 4);
    return;
  }
  const v = parseInt(hex.slice(1), 16);
  img.data[i] = (v >> 16) & 0xff;
  img.data[i + 1] = (v >> 8) & 0xff;
  img.data[i + 2] = v & 0xff;
  img.data[i + 3] = 255;
}

/** Copies every opaque pixel of `src` onto `dst` at (dx, dy), scaled by a whole factor. */
export function blit(dst: Img, src: Img, dx: number, dy: number, scale = 1): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if ((src.data[si + 3] ?? 0) === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const tx = dx + x * scale + sx;
          const ty = dy + y * scale + sy;
          if (tx < 0 || ty < 0 || tx >= dst.w || ty >= dst.h) continue;
          dst.data.set(src.data.subarray(si, si + 4), (ty * dst.w + tx) * 4);
        }
      }
    }
  }
}

/** Fills a rectangle with an opaque colour, clipped to the image. */
export function fillRect(
  img: Img,
  x0: number,
  y0: number,
  w: number,
  h: number,
  hex: string,
): void {
  const v = parseInt(hex.slice(1), 16);
  const px = [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff, 255];
  const xa = Math.max(0, x0);
  const xb = Math.min(img.w, x0 + w);
  if (xb <= xa) return;
  const row = new Uint8Array((xb - xa) * 4);
  for (let i = 0; i < row.length; i += 4) row.set(px, i);
  for (let y = Math.max(0, y0); y < Math.min(img.h, y0 + h); y++)
    img.data.set(row, (y * img.w + xa) * 4);
}

/** The lowest and highest rows holding an opaque pixel, or null for an empty image. */
export function opaqueRows(img: Img): { top: number; bottom: number } | null {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (alphaAt(img, x, y) === 0) continue;
      if (top < 0) top = y;
      bottom = y;
      break;
    }
  }
  return top < 0 ? null : { top, bottom };
}

/** True when two images have the same size and the same pixels. */
export function sameImg(a: Img, b: Img): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}

/** How many pixels differ between two images of the same size. */
export function pixelsChanged(a: Img, b: Img): number {
  let n = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    const j = i * 4;
    if (
      a.data[j] !== b.data[j] ||
      a.data[j + 1] !== b.data[j + 1] ||
      a.data[j + 2] !== b.data[j + 2] ||
      a.data[j + 3] !== b.data[j + 3]
    )
      n++;
  }
  return n;
}
