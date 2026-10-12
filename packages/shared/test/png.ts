import { inflateSync } from 'node:zlib';

/**
 * Minimal PNG reader for the test suite: 8-bit RGB/RGBA, non-interlaced
 * (what the letter sheet is). Returns straight RGBA pixels.
 */
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, i) => bytes[i] === b)) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];
  for (let pos = 8; pos < bytes.length;) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      const depth = data[8];
      const colorType = data[9];
      const interlace = data[12];
      if (depth !== 8 || interlace !== 0)
        throw new Error('unsupported PNG (need 8-bit, non-interlaced)');
      channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
      if (channels === 0) throw new Error(`unsupported PNG color type ${colorType}`);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat.map((d) => Buffer.from(d))));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const line = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const cur = row[x] ?? 0;
      const a = x >= channels ? (line[x - channels] ?? 0) : 0;
      const b = prev[x] ?? 0;
      const c = x >= channels ? (prev[x - channels] ?? 0) : 0;
      let v: number;
      switch (filter) {
        case 1:
          v = cur + a;
          break;
        case 2:
          v = cur + b;
          break;
        case 3:
          v = cur + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          v = cur;
      }
      line[x] = v & 0xff;
    }
    prev.set(line);
  }
  if (channels === 4) return { width, height, rgba: out };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = out[i * 3] ?? 0;
    rgba[i * 4 + 1] = out[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = out[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}
