/**
 * A small zlib stream encoder that is ours, so a built PNG is the same bytes on
 * every machine and every Node version (the system zlib's output may differ
 * between builds and CPUs, which would break `art:check`). Greedy LZ77 over a
 * 32 KiB window with hash chains of a fixed depth, then one fixed-Huffman
 * block (RFC 1951 §3.2.6). Plain and deterministic rather than small; pixel
 * art is mostly long runs, which this compresses well.
 */

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

const WINDOW = 32768;
const MAX_MATCH = 258;
const MIN_MATCH = 3;
const MAX_CHAIN = 16;
/** A match this long is good enough: stop looking for a longer one. */
const NICE_MATCH = 128;
const HASH_BITS = 15;
/** Matches longer than this insert only their last positions into the hash chains. */
const MAX_INSERT = 16;

class BitWriter {
  private buf = new Uint8Array(1 << 16);
  private len = 0;
  private acc = 0;
  private bits = 0;

  /** Writes `n` bits of `value`, least significant first. */
  write(value: number, n: number): void {
    this.acc |= value << this.bits;
    this.bits += n;
    while (this.bits >= 8) {
      this.push(this.acc & 0xff);
      this.acc >>>= 8;
      this.bits -= 8;
    }
  }

  /** Writes a Huffman code of `n` bits, most significant bit first. */
  code(code: number, n: number): void {
    let rev = 0;
    for (let i = 0; i < n; i++) rev |= ((code >> i) & 1) << (n - 1 - i);
    this.write(rev, n);
  }

  bytes(): Uint8Array {
    if (this.bits > 0) {
      this.push(this.acc & 0xff);
      this.acc = 0;
      this.bits = 0;
    }
    return this.buf.subarray(0, this.len);
  }

  private push(b: number): void {
    if (this.len === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.len++] = b;
  }
}

/** The fixed literal/length code of a symbol 0..287. */
function writeLitLen(out: BitWriter, sym: number): void {
  if (sym < 144) out.code(0x30 + sym, 8);
  else if (sym < 256) out.code(0x190 + sym - 144, 9);
  else if (sym < 280) out.code(sym - 256, 7);
  else out.code(0xc0 + sym - 280, 8);
}

function writeMatch(out: BitWriter, length: number, dist: number): void {
  let li = LENGTH_BASE.length - 1;
  while ((LENGTH_BASE[li] ?? 0) > length) li--;
  writeLitLen(out, 257 + li);
  const lx = LENGTH_EXTRA[li] ?? 0;
  if (lx) out.write(length - (LENGTH_BASE[li] ?? 0), lx);
  let di = DIST_BASE.length - 1;
  while ((DIST_BASE[di] ?? 0) > dist) di--;
  out.code(di, 5);
  const dx = DIST_EXTRA[di] ?? 0;
  if (dx) out.write(dist - (DIST_BASE[di] ?? 0), dx);
}

/** Raw DEFLATE (RFC 1951) of `data`: one final fixed-Huffman block. */
export function deflateRaw(data: Uint8Array): Uint8Array {
  const out = new BitWriter();
  out.write(1, 1); // BFINAL
  out.write(1, 2); // BTYPE = 01, fixed Huffman
  const head = new Int32Array(1 << HASH_BITS).fill(-1);
  const prev = new Int32Array(WINDOW).fill(-1);
  const n = data.length;
  const hash = (i: number): number =>
    ((((data[i] ?? 0) << 10) ^ ((data[i + 1] ?? 0) << 5) ^ (data[i + 2] ?? 0)) * 2654435761) >>>
    (32 - HASH_BITS);
  const insert = (i: number): void => {
    if (i + MIN_MATCH > n) return;
    const h = hash(i);
    prev[i % WINDOW] = head[h] ?? -1;
    head[h] = i;
  };
  let i = 0;
  while (i < n) {
    let bestLen = 0;
    let bestDist = 0;
    if (i + MIN_MATCH <= n) {
      let cand = head[hash(i)] ?? -1;
      const maxLen = Math.min(MAX_MATCH, n - i);
      for (let chain = 0; cand >= 0 && i - cand <= WINDOW - 1 && chain < MAX_CHAIN; chain++) {
        let len = 0;
        // Only a candidate that matches one byte past the best so far can beat it.
        if (data[cand + bestLen] === data[i + bestLen])
          while (len < maxLen && data[cand + len] === data[i + len]) len++;
        if (len > bestLen) {
          bestLen = len;
          bestDist = i - cand;
          if (len >= Math.min(maxLen, NICE_MATCH)) break;
        }
        const next = prev[cand % WINDOW] ?? -1;
        if (next >= cand) break;
        cand = next;
      }
    }
    if (bestLen >= MIN_MATCH) {
      writeMatch(out, bestLen, bestDist);
      // Like zlib's fast levels, a long match only seeds the chains at its end.
      for (let k = bestLen > MAX_INSERT ? bestLen - MIN_MATCH : 0; k < bestLen; k++) insert(i + k);
      i += bestLen;
    } else {
      writeLitLen(out, data[i] ?? 0);
      insert(i);
      i++;
    }
  }
  writeLitLen(out, 256);
  return out.bytes();
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i += 5552) {
    const end = Math.min(i + 5552, data.length);
    for (let j = i; j < end; j++) {
      a += data[j] ?? 0;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** A zlib stream (RFC 1950) of `data`. */
export function zlibDeflate(data: Uint8Array): Uint8Array {
  const raw = deflateRaw(data);
  const out = new Uint8Array(raw.length + 6);
  out[0] = 0x78;
  out[1] = 0x01;
  out.set(raw, 2);
  const sum = adler32(data);
  out[raw.length + 2] = (sum >>> 24) & 0xff;
  out[raw.length + 3] = (sum >>> 16) & 0xff;
  out[raw.length + 4] = (sum >>> 8) & 0xff;
  out[raw.length + 5] = sum & 0xff;
  return out;
}
