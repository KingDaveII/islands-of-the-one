import Phaser from 'phaser';

/**
 * A 5x7 pixel font generated at runtime, so text stays crisp at 4x nearest
 * scaling without shipping font assets. Rows use '#' for ink.
 */
const GLYPHS: Record<string, string> = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  ' ': '...../...../...../...../...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../..#../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '-': '...../...../...../.###./...../...../.....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '/': '....#/...#./...#./..#../.#.../.#.../#....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  "'": '..#../..#../...../...../...../...../.....',
  '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '=': '...../...../#####/...../#####/...../.....',
  _: '...../...../...../...../...../...../#####',
  x: '...../...../#...#/.#.#./..#../.#.#./#...#',
  '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
  ']': '.###./...#./...#./...#./...#./...#./.###.',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
};

export const FONT_KEY = 'pixel5x7';
const CELL_W = 6;
const CELL_H = 8;
const CHARS = Object.keys(GLYPHS).join('');
const PER_ROW = 16;

export function registerPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return;
  const rows = Math.ceil(CHARS.length / PER_ROW);
  const tex = scene.textures.createCanvas(`${FONT_KEY}-tex`, PER_ROW * CELL_W, rows * CELL_H);
  if (!tex) throw new Error('could not create font texture');
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  // Glyph keys and rows are plain ASCII, so indexing by UTF-16 unit is exact.
  for (let i = 0; i < CHARS.length; i++) {
    const ox = (i % PER_ROW) * CELL_W;
    const oy = Math.floor(i / PER_ROW) * CELL_H;
    (GLYPHS[CHARS.charAt(i)] ?? '').split('/').forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row.charAt(x) === '#') ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    });
  }
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: `${FONT_KEY}-tex`,
    width: CELL_W,
    height: CELL_H,
    chars: CHARS,
    charsPerRow: PER_ROW,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 2,
  });
  scene.cache.bitmapFont.add(FONT_KEY, data);
}

/** Uppercase text in the pixel font (lowercase 'x' is kept as the times sign). */
export function pixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  scale = 1,
): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(x, y, FONT_KEY, normalize(text)).setTint(color).setScale(scale);
  t.setDropShadow(1, 1, 0x14111f, 1);
  return t;
}

export function normalize(text: string): string {
  return text.replace(/[a-wyz]/g, (c) => c.toUpperCase());
}

export function textWidth(text: string, scale = 1): number {
  return text.length * CELL_W * scale - scale;
}
