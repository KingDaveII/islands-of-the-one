/** Seeds: digits are used as-is (uint32); any other text is hashed (FNV-1a). */
export function parseSeed(text: string): number {
  const t = text.trim().toUpperCase();
  if (/^\d{1,10}$/.test(t) && Number(t) <= 0xffffffff) return Number(t);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

export function randomSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] ?? 1) % 1_000_000_000;
}

export function formatTime(ticks: number): string {
  const totalCs = Math.round((ticks * 100) / 60);
  const m = Math.floor(totalCs / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
