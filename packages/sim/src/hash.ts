/**
 * FNV-1a over a plain-data value tree (numbers, strings, booleans, arrays,
 * objects in key order). Used to compare run states across replays/browsers.
 */
function mix(h: number, v: number): number {
  return Math.imul(h ^ (v & 0xff), 0x01000193) >>> 0;
}

function mixU32(h: number, v: number): number {
  let x = h;
  x = mix(x, v);
  x = mix(x, v >>> 8);
  x = mix(x, v >>> 16);
  x = mix(x, v >>> 24);
  return x;
}

export function hashValue(value: unknown, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error(`non-integer in sim state: ${value}`);
    h = mixU32(h, 1);
    h = mixU32(h, value >>> 0);
    h = mixU32(h, Math.floor(value / 0x1_0000_0000) >>> 0);
  } else if (typeof value === 'string') {
    h = mixU32(h, 2);
    for (let i = 0; i < value.length; i++) h = mixU32(h, value.charCodeAt(i));
  } else if (typeof value === 'boolean') {
    h = mixU32(h, value ? 3 : 4);
  } else if (value === null || value === undefined) {
    h = mixU32(h, 5);
  } else if (Array.isArray(value)) {
    h = mixU32(h, 6);
    h = mixU32(h, value.length);
    for (const v of value) h = hashValue(v, h);
  } else if (typeof value === 'object') {
    h = mixU32(h, 7);
    for (const [k, v] of Object.entries(value)) {
      h = hashValue(k, h);
      h = hashValue(v, h);
    }
  }
  return h;
}
