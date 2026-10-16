import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { deflateRaw, zlibDeflate } from '../src/deflate.js';
import { blank, setPixel } from '../src/image.js';
import { decodePng, encodePng } from '../src/png.js';
import { C, figure } from './helpers.js';

describe('the PNG writer', () => {
  it('writes a zlib stream any inflater reads back', () => {
    const cases = [
      new Uint8Array(0),
      new Uint8Array([1, 2, 3]),
      new Uint8Array(100_000).fill(7),
      Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7919) % 251),
      Uint8Array.from({ length: 40_000 }, (_, i) => (i % 300 < 150 ? 0 : i % 13)),
    ];
    for (const data of cases) {
      expect(new Uint8Array(inflateSync(zlibDeflate(data)))).toEqual(data);
    }
  });

  it('compresses runs (pixel art is mostly runs)', () => {
    expect(deflateRaw(new Uint8Array(1_000_000)).length).toBeLessThan(10_000);
  });

  it('round-trips pixels and gives the same bytes every time, with no chunks besides IHDR, IDAT and IEND', () => {
    const { img } = figure(C['watcher-iron']);
    const a = encodePng(img);
    const b = encodePng(img);
    expect(a.equals(b)).toBe(true);
    expect(decodePng(a)).toEqual(img);
    const types: string[] = [];
    for (let pos = 8; pos < a.length;) {
      const len = a.readUInt32BE(pos);
      types.push(a.toString('ascii', pos + 4, pos + 8));
      pos += 12 + len;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('writes every transparent pixel as 0,0,0,0', () => {
    const img = blank(2, 1);
    setPixel(img, 0, 0, '#123456');
    img.data[3] = 0;
    expect([...decodePng(encodePng(img)).data]).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
