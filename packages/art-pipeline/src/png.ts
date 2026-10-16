import { PNG } from 'pngjs';
import { zlibDeflate } from './deflate.js';
import type { Img } from './image.js';

/** Decodes any PNG pngjs reads (palette, grey, 16-bit, interlaced) to straight RGBA. */
export function decodePng(bytes: Uint8Array): Img {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { w: png.width, h: png.height, data: new Uint8Array(png.data) };
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Encodes an image with fixed settings and nothing else: 8-bit RGBA,
 * non-interlaced, filter 2 (Up) on every row, our own deterministic zlib stream,
 * and only IHDR, IDAT and IEND (no time, text or gamma chunks). Transparent
 * pixels are written as 0,0,0,0. The same pixels always give the same bytes.
 */
export function encodePng(img: Img): Buffer {
  const stride = img.w * 4;
  const pixels = img.data.slice();
  for (let i = 0; i < img.w * img.h; i++)
    if (pixels[i * 4 + 3] === 0) pixels.fill(0, i * 4, i * 4 + 4);
  // Filter 2 (Up) on every row: repeated rows, which pixel art is full of, become zeros.
  const raw = new Uint8Array((stride + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    const at = y * (stride + 1);
    raw[at] = 2;
    for (let x = 0; x < stride; x++) {
      raw[at + 1 + x] =
        ((pixels[y * stride + x] ?? 0) - (y > 0 ? (pixels[(y - 1) * stride + x] ?? 0) : 0)) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibDeflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
