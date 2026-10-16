import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GifReader } from 'omggif';
import { PipelineError } from './errors.js';
import { blank, type Img } from './image.js';
import { decodePng } from './png.js';

/**
 * Step 1, read: a source (a folder of frame-<n>.png, one PNG or a GIF) to
 * frames. Alpha must be 0 or 255; a ×k delivery is reduced only when every
 * k×k block is one colour; a GIF is split, a frame held n times the shortest
 * delay becoming n frames. Nothing is ever scaled otherwise.
 */

/** Fails on any alpha other than 0 or 255, naming the frame and the first such pixel; clears transparent pixels' RGB. */
export function checkAlpha(img: Img, label: string): Img {
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = (y * img.w + x) * 4;
      const a = img.data[i + 3] ?? 0;
      if (a !== 0 && a !== 255) {
        throw new PipelineError(
          `${label}: pixel (${x}, ${y}) has alpha ${a}; only 0 or 255 are allowed`,
        );
      }
      if (a === 0) img.data.fill(0, i, i + 3);
    }
  }
  return img;
}

/** Reduces a ×k image by k, failing unless every k×k block is one colour. */
export function downscale(img: Img, k: number, label: string): Img {
  if (img.w % k || img.h % k)
    throw new PipelineError(`${label}: ${img.w}×${img.h} is not a multiple of the downscale ${k}`);
  const out = blank(img.w / k, img.h / k);
  for (let by = 0; by < out.h; by++) {
    for (let bx = 0; bx < out.w; bx++) {
      const first = (by * k * img.w + bx * k) * 4;
      for (let y = 0; y < k; y++) {
        for (let x = 0; x < k; x++) {
          const i = ((by * k + y) * img.w + bx * k + x) * 4;
          for (let c = 0; c < 4; c++) {
            if (img.data[i + c] !== img.data[first + c]) {
              throw new PipelineError(
                `${label}: the ${k}×${k} block at (${bx * k}, ${by * k}) is not one colour, so it cannot be reduced by ${k}`,
              );
            }
          }
        }
      }
      out.data.set(img.data.subarray(first, first + 4), (by * out.w + bx) * 4);
    }
  }
  return out;
}

/**
 * Splits a GIF into frames, composited the way a browser shows them
 * (disposal 2 clears to transparent, 3 restores the previous frame). A frame
 * whose delay is n times the shortest becomes n frames, since an export merges
 * identical frames; a delay that is not a whole multiple fails.
 */
export function splitGif(bytes: Uint8Array, label: string): Img[] {
  const reader = new GifReader(Buffer.from(bytes));
  const { width: w, height: h } = reader;
  const n = reader.numFrames();
  const infos = Array.from({ length: n }, (_, i) => reader.frameInfo(i));
  const shortest = Math.min(...infos.map((f) => f.delay));
  const out: Img[] = [];
  let canvas = new Uint8Array(w * h * 4);
  for (let i = 0; i < n; i++) {
    const info = infos[i];
    if (!info) continue;
    const before = canvas.slice();
    reader.decodeAndBlitFrameRGBA(i, canvas);
    const times = shortest > 0 ? info.delay / shortest : 1;
    if (!Number.isInteger(times)) {
      throw new PipelineError(
        `${label}: GIF frame ${i} lasts ${info.delay} cs, not a whole multiple of the shortest (${shortest} cs)`,
      );
    }
    for (let t = 0; t < times; t++) out.push({ w, h, data: canvas.slice() });
    if (info.disposal === 2) {
      for (let y = info.y; y < info.y + info.height; y++)
        canvas.fill(0, (y * w + info.x) * 4, (y * w + info.x + info.width) * 4);
    } else if (info.disposal === 3) {
      canvas = before;
    }
  }
  return out;
}

/**
 * Reads source frames on demand, each once per build. `index` is the source
 * frame index (frame-<index>.png, the GIF's split frames, or 0 for one PNG);
 * `who` names the output frame for messages.
 */
export class SourceReader {
  private readonly cache = new Map<string, Img>();
  private readonly gifs = new Map<string, Img[]>();

  constructor(private readonly root: string) {}

  read(src: string, index: number, scale: number | undefined, who: string): Img {
    const key = `${src}#${index}#${scale ?? 1}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const label = `${who} (${src} frame ${index})`;
    const abs = join(this.root, src);
    let img: Img;
    if (statSync(abs).isDirectory()) {
      img = decodePng(readFileSync(join(abs, `frame-${index}.png`)));
    } else if (src.endsWith('.gif')) {
      let frames = this.gifs.get(src);
      if (!frames) {
        frames = splitGif(readFileSync(abs), src);
        this.gifs.set(src, frames);
      }
      const f = frames[index];
      if (!f)
        throw new PipelineError(
          `${label}: the GIF has ${frames.length} frames after splitting, so there is no frame ${index}`,
        );
      img = { w: f.w, h: f.h, data: f.data.slice() };
    } else {
      img = decodePng(readFileSync(abs));
    }
    checkAlpha(img, label);
    if (scale) img = downscale(img, scale, label);
    this.cache.set(key, img);
    return img;
  }
}
