import holdingJson from '../data/holding.json' with { type: 'json' };
import stationsJson from '../data/stations.json' with { type: 'json' };
import { isDrawable } from './accounts.js';
import { isItemId } from './items.js';
import { isStationId } from './places.js';
import { isSkill, type Skill } from './skills.js';
import { STATION_PART_SHEETS } from './sprites.js';
import { shoreProblems, type TileTemplate } from './tiles.js';

/**
 * The holding (docs/design/holding.md): the Kindled's home Shard. Its layout
 * is pure data (data/holding.json): a tile template in the rooms' style with
 * the stations' tile rectangles and interact points (a station may stand in
 * several parts, like the trees), the four plot rectangles Task 5 names, the
 * landing on the south shore and Kesh's rock off the south-east shore. The
 * stations' rules (data/stations.json): what each makes, how often, which
 * skill it trains. Both are validated on load like items.json;
 * `holdingLayoutProblems` is the layout rule the test and the loader share,
 * GAME DESIGN's placement rules for the starting holding included (M2 Task
 * 3c). The server settles the active action from these numbers; the client
 * draws the layout with the shore tile rule (`holdingTemplate`) and walks it
 * with the sim's `roam` (`holdingRoomTiles`).
 */

/**
 * The station kinds: the Writ post, the twisted trees, the stone outcrop, the
 * holding store (its own station by the post, 3c; Use opens the inventory
 * with the store pane) and the weapon rack (Task 8; a reserved spot today).
 */
export const STATION_KINDS = ['post', 'trees', 'outcrop', 'store', 'rack'] as const;
export type StationKind = (typeof STATION_KINDS)[number];

/** The layout legend: ground, the edge, one letter per station kind that stands on the layout, the start. */
export const HOLDING_GROUND = '.';
export const HOLDING_EDGE = '#';
export const HOLDING_START = 'P';
/** The letter a kind's tiles carry; a kind without one (the rack) only ever stands on a reserved spot of plain ground. */
export const STATION_TILE: Readonly<Partial<Record<StationKind, string>>> = { post: 'W', trees: 'T', outcrop: 'R', store: 'S' };
const STATION_LETTERS = Object.values(STATION_TILE).join('');
/** The legend's solid characters: the edge and every station letter (the sim treats them as walls). */
export const HOLDING_SOLID = `${HOLDING_EDGE}${STATION_LETTERS}`;

/** A plot is this many tiles a side (GAME DESIGN's M2 numbers). */
export const PLOT_SIZE = 6;

/**
 * GAME DESIGN's distances for the starting holding (2026-10-18), in tiles
 * between the nearest cells (`rectGap`): the store and the weapon rack within
 * `NEAR_POST` of the post, each tree and the outcrop within `FAR_POST`; the
 * post within `CENTRE_SLACK` of the island's centre; Kesh's rock off the shore
 * by at least `ROCK_OFF_SHORE` of void and within `ROCK_NEAR_SHORE` of ground,
 * its Talk spot within `TALK_REACH` of it.
 */
export const HOLDING_DISTANCES = {
  NEAR_POST: 3,
  FAR_POST: 10,
  CENTRE_SLACK: 2,
  ROCK_OFF_SHORE: 1,
  ROCK_NEAR_SHORE: 6,
  TALK_REACH: 4,
} as const;

export interface TileRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface TilePoint {
  col: number;
  row: number;
}

/** One place a station stands: its tile rectangle and the ground tile beside it the interact prompt and the panel stand on. */
export interface StationPart {
  rect: TileRect;
  interact: TilePoint;
  /** A prop sheet for this part instead of its kind's (`STATION_PART_SHEETS`: the second tree); absent, the kind's. */
  sheet?: string;
}

export interface LayoutStation {
  id: string;
  kind: StationKind;
  /** Where it stands, one part for most stations; the trees have one per tree, and any part's interact point works the station. */
  parts: StationPart[];
  /**
   * A spot kept for a later task (the weapon rack, Task 8): its tiles are
   * plain ground, it draws no prop and offers no Use until then.
   */
  reserved?: boolean;
}

/** Kesh's needle of rock (3c): a solid prop in the void off the south-east shore, and the ground tile Talk across the water stands on (Task 4). */
export interface KeshRock {
  rock: TileRect;
  talk: TilePoint;
}

/**
 * A plot (Task 5): its permanent id (the basket is `basket:<id>`, in the
 * ledger), its `PLOT_SIZE` square and its station, the 1 × 1 at its centre
 * the signpost stands on once the plot is named (a pillar for the sim then)
 * with the interact point just south of it. The layout's plots in order
 * belong to Writ line 1, `linePlots` per line (`plotLine`).
 */
export interface LayoutPlot {
  id: string;
  rect: TileRect;
  station: StationPart;
}

export interface HoldingLayout {
  id: string;
  tiles: string[];
  stations: LayoutStation[];
  plots: LayoutPlot[];
  /** Where the boat ties up later, a ground tile on the south shore; no prop or action yet. */
  landing: TilePoint;
  kesh: KeshRock;
}

/** What a working station makes each cycle and the skill it trains. */
export interface StationAction {
  /** The action's name in text ("a dead branch"). */
  name: string;
  itemId: string;
  /** Per cycle. */
  quantity: number;
  cycleMs: number;
  skill: Skill;
  /** XP per cycle: the action's base time in seconds (GAME DESIGN's curve). */
  xp: number;
}

/**
 * A basket cycle (Task 5): the passive trickle a station makes on its own
 * while the Writ has charge, `quantity` of an item into its basket every
 * `cycleMs`, no XP (GAME DESIGN's "one mechanism"). Optional on any station
 * or plot kind; today only the field has one.
 */
export interface StationCycle {
  itemId: string;
  quantity: number;
  cycleMs: number;
}

/** What a new plot of a kind is sown with, once, before it cycles or can be worked (the field: 1 grey seed). */
export interface PlotSowing {
  itemId: string;
  quantity: number;
}

export interface StationDef {
  id: string;
  kind: StationKind;
  name: string;
  /** Null for the post and the store (Use opens the inventory with the store pane) and the rack (reserved). */
  action: StationAction | null;
  /** The basket cycle, or null (no station has one today). */
  cycle: StationCycle | null;
}

/** What a Ground word builds on a plot (Task 5): a named plot is a station of this kind with the plot's id. */
export interface PlotKindDef {
  id: string;
  name: string;
  action: StationAction;
  cycle: StationCycle | null;
  /** What sows a new plot of this kind, or null for a kind that needs no sowing. */
  sow: PlotSowing | null;
}

/** The kinds with no action: Use opens the inventory (post, store), or nothing yet (rack). */
export const ACTIONLESS_KINDS: readonly StationKind[] = ['post', 'store', 'rack'];

export interface HoldingData {
  offlineCapHours: number;
  heartbeatMs: number;
  /** How far past every edge of the layout the camera may scroll into the void (tiles), so the HUD never covers the shore or Kesh's rock. */
  cameraMarginTiles: number;
  layouts: HoldingLayout[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const isIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isKind = (value: unknown): value is StationKind =>
  typeof value === 'string' && (STATION_KINDS as readonly string[]).includes(value);

function parseRect(v: unknown, at: string, problems: string[]): TileRect | null {
  if (!isObject(v) || !isIndex(v.col) || !isIndex(v.row) || !isCount(v.cols) || !isCount(v.rows)) {
    problems.push(`${at}: must be { col, row, cols, rows } of whole numbers`);
    return null;
  }
  const extra = Object.keys(v).filter((k) => !['col', 'row', 'cols', 'rows'].includes(k));
  if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
  return { col: v.col, row: v.row, cols: v.cols, rows: v.rows };
}

function parsePoint(v: unknown, at: string, problems: string[]): TilePoint | null {
  if (!isObject(v) || !isIndex(v.col) || !isIndex(v.row)) {
    problems.push(`${at}: must be { col, row }`);
    return null;
  }
  const extra = Object.keys(v).filter((k) => !['col', 'row'].includes(k));
  if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
  return { col: v.col, row: v.row };
}

/** Whether two rectangles share a cell. */
export function rectsOverlap(a: TileRect, b: TileRect): boolean {
  return a.col < b.col + b.cols && b.col < a.col + a.cols && a.row < b.row + b.rows && b.row < a.row + a.rows;
}

/** The tiles between two rectangles' nearest cells (Chebyshev): 0 when they overlap or touch, 1 with one cell between. */
export function rectGap(a: TileRect, b: TileRect): number {
  const dc = Math.max(0, b.col - (a.col + a.cols) + 1, a.col - (b.col + b.cols) + 1);
  const dr = Math.max(0, b.row - (a.row + a.rows) + 1, a.row - (b.row + b.rows) + 1);
  return Math.max(dc, dr);
}

/** Whether two rectangles overlap or touch, diagonally included. */
export function rectsTouch(a: TileRect, b: TileRect): boolean {
  return rectGap(a, b) <= 1;
}

const pointRect = (p: TilePoint): TileRect => ({ col: p.col, row: p.row, cols: 1, rows: 1 });

/** An action block of stations.json: the yield, the cycle, the skill and the XP (the cycle's seconds). */
function parseAction(action: unknown, where: string, problems: string[]): StationAction | null {
  if (!isObject(action)) {
    problems.push(`${where}: action must be an object`);
    return null;
  }
  const before = problems.length;
  const keys = ['name', 'itemId', 'quantity', 'cycleMs', 'skill', 'xp'];
  const more = Object.keys(action).filter((k) => !keys.includes(k));
  if (more.length > 0) problems.push(`${where}: action has unknown field(s) ${more.join(', ')}`);
  const a = action;
  if (typeof a.name !== 'string' || a.name.trim() === '' || !isDrawable(a.name))
    problems.push(`${where}: action.name must be text the game can draw`);
  if (!isItemId(a.itemId)) problems.push(`${where}: action.itemId must be an item of items.json`);
  if (!isCount(a.quantity)) problems.push(`${where}: action.quantity must be a positive integer`);
  if (!isCount(a.cycleMs)) problems.push(`${where}: action.cycleMs must be a positive integer`);
  if (!isSkill(a.skill)) problems.push(`${where}: action.skill must be a skill`);
  if (!isIndex(a.xp)) problems.push(`${where}: action.xp must be a whole number`);
  else if (isCount(a.cycleMs) && a.xp !== a.cycleMs / 1000)
    problems.push(`${where}: action.xp is ${a.xp}; the curve gives the cycle's seconds, ${a.cycleMs / 1000}`);
  if (problems.length > before) return null;
  return {
    name: a.name as string,
    itemId: a.itemId as string,
    quantity: a.quantity as number,
    cycleMs: a.cycleMs as number,
    skill: a.skill as Skill,
    xp: a.xp as number,
  };
}

/** A cycle block of stations.json: the item, the quantity and the cycle, positive whole numbers. */
function parseCycle(cycle: unknown, where: string, problems: string[]): StationCycle | null {
  if (!isObject(cycle)) {
    problems.push(`${where}: cycle must be an object`);
    return null;
  }
  const before = problems.length;
  const more = Object.keys(cycle).filter((k) => !['itemId', 'quantity', 'cycleMs'].includes(k));
  if (more.length > 0) problems.push(`${where}: cycle has unknown field(s) ${more.join(', ')}`);
  if (!isItemId(cycle.itemId)) problems.push(`${where}: cycle.itemId must be an item of items.json`);
  if (!isCount(cycle.quantity)) problems.push(`${where}: cycle.quantity must be a positive integer`);
  if (!isCount(cycle.cycleMs)) problems.push(`${where}: cycle.cycleMs must be a positive integer`);
  if (problems.length > before) return null;
  return { itemId: cycle.itemId as string, quantity: cycle.quantity as number, cycleMs: cycle.cycleMs as number };
}

/** A sow block of a plot kind: the item and the count, positive whole numbers. */
function parseSow(sow: unknown, where: string, problems: string[]): PlotSowing | null {
  if (!isObject(sow)) {
    problems.push(`${where}: sow must be an object`);
    return null;
  }
  const before = problems.length;
  const more = Object.keys(sow).filter((k) => !['itemId', 'quantity'].includes(k));
  if (more.length > 0) problems.push(`${where}: sow has unknown field(s) ${more.join(', ')}`);
  if (!isItemId(sow.itemId)) problems.push(`${where}: sow.itemId must be an item of items.json`);
  if (!isCount(sow.quantity)) problems.push(`${where}: sow.quantity must be a positive integer`);
  if (problems.length > before) return null;
  return { itemId: sow.itemId as string, quantity: sow.quantity as number };
}

/** Check stations.json-shaped data (the stations and the plot kinds); every problem is listed. */
export function validateStationsData(
  data: unknown,
): { ok: true; stations: StationDef[]; plotKinds: PlotKindDef[] } | { ok: false; problems: string[] } {
  if (!isObject(data) || !Array.isArray(data.stations))
    return { ok: false, problems: ['expected { stations: [...] }'] };
  const problems: string[] = [];
  const stations: StationDef[] = [];
  const seen = new Set<string>();
  const extraTop = Object.keys(data).filter((k) => !['$comment', 'stations', 'plotKinds'].includes(k));
  if (extraTop.length > 0) problems.push(`unknown field(s) ${extraTop.join(', ')}`);
  data.stations.forEach((entry: unknown, i) => {
    const at = `stations[${i}]`;
    if (!isObject(entry)) {
      problems.push(`${at}: not an object`);
      return;
    }
    const extra = Object.keys(entry).filter((k) => !['id', 'kind', 'name', 'action', 'cycle'].includes(k));
    if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
    const { id, kind, name, action, cycle } = entry;
    if (!isStationId(id)) {
      problems.push(`${at}: id must be kebab-case (it names the basket)`);
      return;
    }
    const where = `${at} (${id})`;
    if (seen.has(id)) problems.push(`${where}: duplicate id`);
    seen.add(id);
    if (!isKind(kind)) problems.push(`${where}: kind must be one of ${STATION_KINDS.join(', ')}`);
    if (typeof name !== 'string' || name.trim() === '' || !isDrawable(name))
      problems.push(`${where}: name must be non-empty text the game can draw`);
    const parsed = action === undefined ? null : parseAction(action, where, problems);
    const parsedCycle = cycle === undefined ? null : parseCycle(cycle, where, problems);
    if (isKind(kind) && ACTIONLESS_KINDS.includes(kind) && action !== undefined) problems.push(`${where}: the ${kind} has no action`);
    if (isKind(kind) && !ACTIONLESS_KINDS.includes(kind) && action === undefined) problems.push(`${where}: a ${kind} needs an action`);
    if (isKind(kind) && ACTIONLESS_KINDS.includes(kind) && cycle !== undefined) problems.push(`${where}: the ${kind} has no cycle`);
    if (problems.length > 0) return;
    stations.push({ id, kind: kind as StationKind, name: name as string, action: parsed, cycle: parsedCycle });
  });
  const plotKinds: PlotKindDef[] = [];
  if (data.plotKinds !== undefined) {
    if (!Array.isArray(data.plotKinds)) problems.push('plotKinds must be a list');
    else
      data.plotKinds.forEach((entry: unknown, i) => {
        const at = `plotKinds[${i}]`;
        if (!isObject(entry)) {
          problems.push(`${at}: not an object`);
          return;
        }
        const extra = Object.keys(entry).filter((k) => !['id', 'name', 'action', 'cycle', 'sow'].includes(k));
        if (extra.length > 0) problems.push(`${at}: unknown field(s) ${extra.join(', ')}`);
        const { id, name, action, cycle, sow } = entry;
        if (!isStationId(id)) {
          problems.push(`${at}: id must be kebab-case`);
          return;
        }
        const where = `${at} (${id})`;
        if (seen.has(id)) problems.push(`${where}: duplicate id (a station or another plot kind)`);
        seen.add(id);
        if (typeof name !== 'string' || name.trim() === '' || !isDrawable(name))
          problems.push(`${where}: name must be non-empty text the game can draw`);
        const before = problems.length;
        const parsed = action === undefined ? null : parseAction(action, where, problems);
        if (action === undefined) problems.push(`${where}: a plot kind needs an action`);
        const parsedCycle = cycle === undefined ? null : parseCycle(cycle, where, problems);
        const parsedSow = sow === undefined ? null : parseSow(sow, where, problems);
        if (problems.length > before || !parsed) return;
        plotKinds.push({ id, name: name as string, action: parsed, cycle: parsedCycle, sow: parsedSow });
      });
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, stations, plotKinds };
}

/**
 * Where a layout breaks the rules (docs/design/holding.md, GAME DESIGN
 * 2026-10-18), one line each, or none: the template is rectangular, only
 * legend characters, its border all edge (so the shore's drops and corners
 * fit inside it) and free of the one-cell notch the shore pieces can't draw;
 * every station's id is in `stations` with its kind, each of its parts is
 * inside the layout with every tile its kind's letter (so solid for the sim;
 * a reserved spot's are plain ground), its interact point ground beside the
 * part and reachable from the start; every station letter belongs to a
 * station; there is one Writ post, near the island's centre; the store and
 * the rack are within `NEAR_POST` of it, every tree (west of it) and the
 * outcrop (east of it) within `FAR_POST`; the plots are `PLOT_SIZE` square,
 * on ground, and touch neither each other, the post nor the store, nor
 * overlap any station; the landing is ground on the south shore; Kesh's rock
 * is void off the south-east shore with its Talk spot on reachable ground
 * beside the water; a plot's worth of free ground lies north of the post;
 * there is exactly one start, on ground.
 */
export function holdingLayoutProblems(layout: HoldingLayout, stations: readonly StationDef[]): string[] {
  const problems: string[] = [];
  const name = layout.id;
  const rows = layout.tiles.length;
  const cols = layout.tiles[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return [`${name}: the layout has no tiles`];
  const legend = `${HOLDING_GROUND}${HOLDING_EDGE}${HOLDING_START}${STATION_LETTERS}`;
  layout.tiles.forEach((row, r) => {
    if (row.length !== cols) problems.push(`${name}: row ${r} is ${row.length} wide, not ${cols}`);
    for (const ch of row) if (!legend.includes(ch)) problems.push(`${name}: row ${r} has "${ch}", not in the legend`);
  });
  const at = (c: number, r: number): string =>
    r < 0 || r >= rows || c < 0 || c >= cols ? HOLDING_EDGE : (layout.tiles[r]?.[c] ?? HOLDING_EDGE);
  const ground = (c: number, r: number): boolean => at(c, r) === HOLDING_GROUND || at(c, r) === HOLDING_START;
  const island = (c: number, r: number): boolean => at(c, r) !== HOLDING_EDGE;
  const inside = (rect: TileRect): boolean =>
    rect.col >= 0 && rect.row >= 0 && rect.col + rect.cols <= cols && rect.row + rect.rows <= rows;
  const beside = (p: TilePoint, rect: TileRect): boolean =>
    (p.row >= rect.row && p.row < rect.row + rect.rows && (p.col === rect.col - 1 || p.col === rect.col + rect.cols)) ||
    (p.col >= rect.col && p.col < rect.col + rect.cols && (p.row === rect.row - 1 || p.row === rect.row + rect.rows));
  const cell = (p: TilePoint): string => `(${p.col}, ${p.row})`;

  // The border: all edge, so every drop and corner the shore rule draws has a cell inside the template.
  const borderHoles: string[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if ((r === 0 || r === rows - 1 || c === 0 || c === cols - 1) && at(c, r) !== HOLDING_EDGE) borderHoles.push(`(${c}, ${r})`);
  if (borderHoles.length)
    problems.push(`${name}: the border must be edge (#) all round, so the shore's drops fit the template; not at ${borderHoles.join(' ')}`);
  problems.push(...shoreProblems(holdingTemplate(layout)));

  // The start.
  const starts: TilePoint[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (at(c, r) === HOLDING_START) starts.push({ col: c, row: r });
  if (starts.length !== 1) problems.push(`${name}: ${starts.length} start tiles (P); there must be one`);
  // Everything the Kindled can walk to from the start.
  const reach = new Set<string>();
  const start = starts[0];
  if (start) {
    const stack = [start];
    reach.add(`${start.col},${start.row}`);
    while (stack.length) {
      const p = stack.pop();
      if (!p) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = p.col + dc;
        const r = p.row + dr;
        const key = `${c},${r}`;
        if (reach.has(key) || !ground(c, r)) continue;
        reach.add(key);
        stack.push({ col: c, row: r });
      }
    }
  }
  const reachable = (p: TilePoint): boolean => reach.has(`${p.col},${p.row}`);

  // The stations.
  const ids = new Set<string>();
  const covered = new Set<string>();
  const byKind = new Map<StationKind, LayoutStation[]>();
  for (const s of layout.stations) {
    const where = `${name}: station ${s.id}`;
    if (ids.has(s.id)) problems.push(`${where} is listed twice`);
    ids.add(s.id);
    byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s]);
    const def = stations.find((d) => d.id === s.id);
    if (!def) problems.push(`${where} is not in stations.json`);
    else if (def.kind !== s.kind) problems.push(`${where} is a ${s.kind} here but a ${def.kind} in stations.json`);
    if (s.reserved && def?.action) problems.push(`${where} is reserved, but has an action in stations.json`);
    if (s.parts.length === 0) problems.push(`${where} has no parts`);
    const letter = s.reserved ? HOLDING_GROUND : STATION_TILE[s.kind];
    if (letter === undefined) {
      problems.push(`${where}: a ${s.kind} has no tile letter, so it can only stand on a reserved spot`);
      continue;
    }
    s.parts.forEach((part, i) => {
      const pw = s.parts.length > 1 ? `${where} part ${i}` : where;
      if (!inside(part.rect)) {
        problems.push(`${pw}: its rectangle is outside the layout`);
        return;
      }
      for (let r = part.rect.row; r < part.rect.row + part.rect.rows; r++) {
        for (let c = part.rect.col; c < part.rect.col + part.rect.cols; c++) {
          covered.add(`${c},${r}`);
          if (at(c, r) !== letter)
            problems.push(`${pw}: tile (${c}, ${r}) is "${at(c, r)}", not ${s.reserved ? 'ground (a reserved spot)' : letter}`);
        }
      }
      const p = part.interact;
      if (!ground(p.col, p.row)) problems.push(`${pw}: its interact point ${cell(p)} is not ground`);
      else if (!beside(p, part.rect)) problems.push(`${pw}: its interact point ${cell(p)} is not beside it`);
      else if (!reachable(p)) problems.push(`${pw}: its interact point ${cell(p)} can't be reached from the start`);
      for (const other of layout.stations) {
        if (other === s) continue;
        for (const op of other.parts)
          if (rectsOverlap(part.rect, op.rect)) problems.push(`${pw} overlaps station ${other.id}`);
      }
      s.parts.forEach((op, j) => {
        if (j > i && rectsOverlap(part.rect, op.rect)) problems.push(`${pw} overlaps its part ${j}`);
      });
    });
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (STATION_LETTERS.includes(at(c, r)) && !covered.has(`${c},${r}`))
        problems.push(`${name}: tile (${c}, ${r}) is "${at(c, r)}" but belongs to no station`);
    }
  }

  // GAME DESIGN's placement: one post near the centre, the rest placed by it.
  const posts = byKind.get('post') ?? [];
  const post = posts[0]?.parts[0]?.rect;
  if (posts.length !== 1) problems.push(`${name}: ${posts.length} Writ posts; there must be one`);
  const D = HOLDING_DISTANCES;
  if (post) {
    let c0 = cols;
    let c1 = -1;
    let r0 = rows;
    let r1 = -1;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (island(c, r)) {
          c0 = Math.min(c0, c);
          c1 = Math.max(c1, c);
          r0 = Math.min(r0, r);
          r1 = Math.max(r1, r);
        }
    const centre = { col: (c0 + c1) / 2, row: (r0 + r1) / 2 };
    if (Math.abs(post.col - centre.col) > D.CENTRE_SLACK || Math.abs(post.row - centre.row) > D.CENTRE_SLACK)
      problems.push(
        `${name}: the Writ post at (${post.col}, ${post.row}) is not at the island's centre (${centre.col}, ${centre.row}), within ${D.CENTRE_SLACK} tiles`,
      );
    const near = (kind: StationKind, limit: number, side: 'west' | 'east' | null): void => {
      for (const s of byKind.get(kind) ?? []) {
        s.parts.forEach((part, i) => {
          const pw = s.parts.length > 1 ? `${name}: station ${s.id} part ${i}` : `${name}: station ${s.id}`;
          const gap = rectGap(part.rect, post);
          if (gap > limit) problems.push(`${pw} is ${gap} tiles from the post; at most ${limit}`);
          if (side === 'west' && part.rect.col + part.rect.cols > post.col) problems.push(`${pw} is not west of the post`);
          if (side === 'east' && part.rect.col < post.col + post.cols) problems.push(`${pw} is not east of the post`);
        });
      }
    };
    near('store', D.NEAR_POST, null);
    near('rack', D.NEAR_POST, null);
    near('trees', D.FAR_POST, 'west');
    near('outcrop', D.FAR_POST, 'east');
  }

  // The plots: on ground, overlapping no station, touching neither each other, the post nor the store; ids
  // unique and kebab-case (and no station's); the station's 1 × 1 and its interact point inside the plot, the
  // interact point ground and reachable from the start (Task 5).
  const stores = (byKind.get('store') ?? []).flatMap((s) => s.parts.map((p) => p.rect));
  const plotIds = new Set<string>();
  const within = (inner: TileRect, outer: TileRect): boolean =>
    inner.col >= outer.col && inner.row >= outer.row && inner.col + inner.cols <= outer.col + outer.cols && inner.row + inner.rows <= outer.row + outer.rows;
  layout.plots.forEach(({ id, rect: plot, station }, i) => {
    const where = `${name}: plot ${i}`;
    if (!isStationId(id)) problems.push(`${where}: id ${JSON.stringify(id)} must be kebab-case (it names the basket)`);
    else if (plotIds.has(id)) problems.push(`${where}: id ${id} is listed twice`);
    else if (ids.has(id)) problems.push(`${where}: id ${id} is a station's`);
    plotIds.add(id);
    if (plot.cols !== PLOT_SIZE || plot.rows !== PLOT_SIZE)
      problems.push(`${where} is ${plot.cols} × ${plot.rows}, not ${PLOT_SIZE} × ${PLOT_SIZE}`);
    if (!inside(plot)) {
      problems.push(`${where} is outside the layout`);
      return;
    }
    for (let r = plot.row; r < plot.row + plot.rows; r++)
      for (let c = plot.col; c < plot.col + plot.cols; c++)
        if (at(c, r) !== HOLDING_GROUND) problems.push(`${where}: tile (${c}, ${r}) is "${at(c, r)}", not ground`);
    for (const s of layout.stations)
      if (s.parts.some((p) => rectsOverlap(plot, p.rect))) problems.push(`${where} overlaps station ${s.id}`);
    if (post && rectsTouch(plot, post)) problems.push(`${where} touches the Writ post`);
    if (stores.some((r) => rectsTouch(plot, r))) problems.push(`${where} touches the store`);
    layout.plots.forEach((other, j) => {
      if (j <= i) return;
      if (rectsOverlap(plot, other.rect)) problems.push(`${where} overlaps plot ${j}`);
      else if (rectsTouch(plot, other.rect)) problems.push(`${where} touches plot ${j}`);
    });
    if (station.rect.cols !== 1 || station.rect.rows !== 1) problems.push(`${where}: its station is ${station.rect.cols} × ${station.rect.rows}, not 1 × 1`);
    if (!within(station.rect, plot)) problems.push(`${where}: its station (${station.rect.col}, ${station.rect.row}) is not inside the plot`);
    if (!within(pointRect(station.interact), plot)) problems.push(`${where}: its interact point ${cell(station.interact)} is not inside the plot`);
    else if (!ground(station.interact.col, station.interact.row)) problems.push(`${where}: its interact point ${cell(station.interact)} is not ground`);
    else if (!reachable(station.interact)) problems.push(`${where}: its interact point ${cell(station.interact)} can't be reached from the start`);
    if (rectsOverlap(station.rect, pointRect(station.interact))) problems.push(`${where}: its interact point ${cell(station.interact)} is on its station`);
  });

  // The landing: ground on the south shore, south of the post.
  const landing = layout.landing;
  if (!ground(landing.col, landing.row)) problems.push(`${name}: the landing ${cell(landing)} is not ground`);
  else {
    if (island(landing.col, landing.row + 1)) problems.push(`${name}: the landing ${cell(landing)} is not on the shore (the cell south of it is not void)`);
    if (post && landing.row <= post.row) problems.push(`${name}: the landing ${cell(landing)} is not on the south shore (north of the post)`);
    if (!reachable(landing)) problems.push(`${name}: the landing ${cell(landing)} can't be reached from the start`);
  }

  // Kesh's rock: void, off the south-east shore with water between, near enough; its Talk spot on reachable ground beside it.
  const { rock, talk } = layout.kesh;
  if (!inside(rock)) problems.push(`${name}: Kesh's rock is outside the layout`);
  else {
    let nearest = Infinity;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (island(c, r)) nearest = Math.min(nearest, rectGap(rock, pointRect({ col: c, row: r })));
    for (let r = rock.row; r < rock.row + rock.rows; r++)
      for (let c = rock.col; c < rock.col + rock.cols; c++)
        if (at(c, r) !== HOLDING_EDGE) problems.push(`${name}: Kesh's rock tile (${c}, ${r}) is "${at(c, r)}", not void (#)`);
    if (nearest <= D.ROCK_OFF_SHORE) problems.push(`${name}: Kesh's rock touches the island; it stands off the shore with at least ${D.ROCK_OFF_SHORE} cell of void between`);
    if (nearest > D.ROCK_NEAR_SHORE) problems.push(`${name}: Kesh's rock is ${nearest} tiles off the shore; at most ${D.ROCK_NEAR_SHORE}`);
    if (post && (rock.col < post.col + post.cols || rock.row < post.row + post.rows))
      problems.push(`${name}: Kesh's rock is not off the south-east shore (south and east of the post)`);
    if (!ground(talk.col, talk.row)) problems.push(`${name}: the Talk spot ${cell(talk)} is not ground`);
    else if (!reachable(talk)) problems.push(`${name}: the Talk spot ${cell(talk)} can't be reached from the start`);
    else if (rectGap(pointRect(talk), rock) > D.TALK_REACH)
      problems.push(`${name}: the Talk spot ${cell(talk)} is ${rectGap(pointRect(talk), rock)} tiles from Kesh's rock; at most ${D.TALK_REACH}`);
  }

  // Free ground on the north side: a plot's square of plain ground, wholly north of the post, clear of every plot and station.
  if (post) {
    const taken = [...layout.plots.map((p) => p.rect), ...layout.stations.flatMap((s) => s.parts.map((p) => p.rect))];
    let free = false;
    for (let r = 0; !free && r + PLOT_SIZE <= post.row; r++) {
      for (let c = 0; !free && c + PLOT_SIZE <= cols; c++) {
        const square = { col: c, row: r, cols: PLOT_SIZE, rows: PLOT_SIZE };
        if (taken.some((t) => rectsOverlap(square, t))) continue;
        let clear = true;
        for (let rr = r; clear && rr < r + PLOT_SIZE; rr++)
          for (let cc = c; clear && cc < c + PLOT_SIZE; cc++) if (at(cc, rr) !== HOLDING_GROUND) clear = false;
        free = clear;
      }
    }
    if (!free) problems.push(`${name}: no free ${PLOT_SIZE} × ${PLOT_SIZE} of ground north of the post for later Writ lines' plots`);
  }
  return problems;
}

/** Check holding.json-shaped data against `stations`; every problem is listed. */
export function validateHoldingData(
  data: unknown,
  stations: readonly StationDef[],
): { ok: true; data: HoldingData } | { ok: false; problems: string[] } {
  if (!isObject(data)) return { ok: false, problems: ['expected an object'] };
  const problems: string[] = [];
  const extra = Object.keys(data).filter((k) => !['$comment', 'offlineCapHours', 'heartbeatMs', 'cameraMarginTiles', 'layouts'].includes(k));
  if (extra.length > 0) problems.push(`unknown field(s) ${extra.join(', ')}`);
  if (!isCount(data.offlineCapHours)) problems.push('offlineCapHours must be a positive integer');
  if (!isCount(data.heartbeatMs)) problems.push('heartbeatMs must be a positive integer');
  if (!isCount(data.cameraMarginTiles)) problems.push('cameraMarginTiles must be a positive integer');
  const layouts: HoldingLayout[] = [];
  if (!Array.isArray(data.layouts) || data.layouts.length === 0) problems.push('layouts must be a non-empty list');
  else {
    const ids = new Set<string>();
    data.layouts.forEach((entry: unknown, i) => {
      const at = `layouts[${i}]`;
      if (!isObject(entry)) {
        problems.push(`${at}: not an object`);
        return;
      }
      const more = Object.keys(entry).filter((k) => !['id', 'tiles', 'stations', 'plots', 'landing', 'kesh'].includes(k));
      if (more.length > 0) problems.push(`${at}: unknown field(s) ${more.join(', ')}`);
      const { id, tiles, stations: list, plots, landing, kesh } = entry;
      if (!isStationId(id)) {
        problems.push(`${at}: id must be kebab-case`);
        return;
      }
      if (ids.has(id)) problems.push(`${at}: duplicate id ${id}`);
      ids.add(id);
      const before = problems.length;
      if (!Array.isArray(tiles) || tiles.length === 0 || !tiles.every((r) => typeof r === 'string'))
        problems.push(`${at} (${id}): tiles must be a non-empty list of rows`);
      const parsedStations: LayoutStation[] = [];
      if (!Array.isArray(list)) problems.push(`${at} (${id}): stations must be a list`);
      else
        list.forEach((s: unknown, j) => {
          const sat = `${at} (${id}): stations[${j}]`;
          if (!isObject(s) || !isStationId(s.id) || !isKind(s.kind)) {
            problems.push(`${sat}: must have a kebab-case id and a kind (${STATION_KINDS.join(', ')})`);
            return;
          }
          const sExtra = Object.keys(s).filter((k) => !['id', 'kind', 'parts', 'reserved'].includes(k));
          if (sExtra.length > 0) problems.push(`${sat}: unknown field(s) ${sExtra.join(', ')}`);
          if (s.reserved !== undefined && s.reserved !== true) problems.push(`${sat}.reserved: must be true when present`);
          if (!Array.isArray(s.parts) || s.parts.length === 0) {
            problems.push(`${sat}.parts: must be a non-empty list of { rect, interact }`);
            return;
          }
          const parts: StationPart[] = [];
          s.parts.forEach((part: unknown, k) => {
            const pat = `${sat}.parts[${k}]`;
            if (!isObject(part)) {
              problems.push(`${pat}: must be { rect, interact }`);
              return;
            }
            const pExtra = Object.keys(part).filter((key) => !['rect', 'interact', 'sheet'].includes(key));
            if (pExtra.length > 0) problems.push(`${pat}: unknown field(s) ${pExtra.join(', ')}`);
            const rect = parseRect(part.rect, `${pat}.rect`, problems);
            const interact = parsePoint(part.interact, `${pat}.interact`, problems);
            const allowed: readonly string[] = (isKind(s.kind) ? STATION_PART_SHEETS[s.kind] : undefined) ?? [];
            if (part.sheet !== undefined && (typeof part.sheet !== 'string' || !allowed.includes(part.sheet)))
              problems.push(
                `${pat}.sheet: ${JSON.stringify(part.sheet)} is not a sheet a ${String(s.kind)} part may name (${allowed.join(', ') || 'none'})`,
              );
            if (rect && interact) parts.push(typeof part.sheet === 'string' && allowed.includes(part.sheet) ? { rect, interact, sheet: part.sheet } : { rect, interact });
          });
          const station: LayoutStation = { id: s.id, kind: s.kind, parts };
          if (s.reserved === true) station.reserved = true;
          parsedStations.push(station);
        });
      const parsedPlots: LayoutPlot[] = [];
      if (!Array.isArray(plots)) problems.push(`${at} (${id}): plots must be a list`);
      else
        plots.forEach((p: unknown, j) => {
          const pat = `${at} (${id}): plots[${j}]`;
          if (!isObject(p) || typeof p.id !== 'string') {
            problems.push(`${pat}: must be { id, rect, station: { rect, interact } }`);
            return;
          }
          const pExtra = Object.keys(p).filter((k) => !['id', 'rect', 'station'].includes(k));
          if (pExtra.length > 0) problems.push(`${pat}: unknown field(s) ${pExtra.join(', ')}`);
          const rect = parseRect(p.rect, `${pat}.rect`, problems);
          if (!isObject(p.station)) {
            problems.push(`${pat}.station: must be { rect, interact }`);
            return;
          }
          const sExtra = Object.keys(p.station).filter((k) => !['rect', 'interact'].includes(k));
          if (sExtra.length > 0) problems.push(`${pat}.station: unknown field(s) ${sExtra.join(', ')}`);
          const sRect = parseRect(p.station.rect, `${pat}.station.rect`, problems);
          const interact = parsePoint(p.station.interact, `${pat}.station.interact`, problems);
          if (rect && sRect && interact) parsedPlots.push({ id: p.id, rect, station: { rect: sRect, interact } });
        });
      const parsedLanding = parsePoint(landing, `${at} (${id}): landing`, problems);
      let parsedKesh: KeshRock | null = null;
      if (!isObject(kesh)) problems.push(`${at} (${id}): kesh must be { rock, talk }`);
      else {
        const kExtra = Object.keys(kesh).filter((k) => !['rock', 'talk'].includes(k));
        if (kExtra.length > 0) problems.push(`${at} (${id}): kesh has unknown field(s) ${kExtra.join(', ')}`);
        const rock = parseRect(kesh.rock, `${at} (${id}): kesh.rock`, problems);
        const talk = parsePoint(kesh.talk, `${at} (${id}): kesh.talk`, problems);
        if (rock && talk) parsedKesh = { rock, talk };
      }
      if (problems.length > before || !parsedLanding || !parsedKesh) return;
      const layout: HoldingLayout = {
        id,
        tiles: tiles as string[],
        stations: parsedStations,
        plots: parsedPlots,
        landing: parsedLanding,
        kesh: parsedKesh,
      };
      problems.push(...holdingLayoutProblems(layout, stations));
      layouts.push(layout);
    });
  }
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    data: {
      offlineCapHours: data.offlineCapHours as number,
      heartbeatMs: data.heartbeatMs as number,
      cameraMarginTiles: data.cameraMarginTiles as number,
      layouts,
    },
  };
}

function loadStations(): { stations: readonly StationDef[]; plotKinds: readonly PlotKindDef[] } {
  const result = validateStationsData(stationsJson);
  if (!result.ok) throw new Error(`data/stations.json:\n${result.problems.join('\n')}`);
  return { stations: result.stations, plotKinds: result.plotKinds };
}

const LOADED = loadStations();
/** Every station, in stations.json order. */
export const STATIONS: readonly StationDef[] = LOADED.stations;
/** Every plot kind, in stations.json order (Task 5: the field). */
export const PLOT_KINDS: readonly PlotKindDef[] = LOADED.plotKinds;
const STATION_BY_ID: ReadonlyMap<string, StationDef> = new Map(STATIONS.map((s) => [s.id, s]));
const PLOT_KIND_BY_ID: ReadonlyMap<string, PlotKindDef> = new Map(PLOT_KINDS.map((p) => [p.id, p]));

export function stationDef(id: string): StationDef | undefined {
  return STATION_BY_ID.get(id);
}

export function plotKindDef(id: string): PlotKindDef | undefined {
  return PLOT_KIND_BY_ID.get(id);
}

export function isPlotKindId(value: unknown): value is string {
  return typeof value === 'string' && PLOT_KIND_BY_ID.has(value);
}

function loadHolding(): HoldingData {
  const result = validateHoldingData(holdingJson, STATIONS);
  if (!result.ok) throw new Error(`data/holding.json:\n${result.problems.join('\n')}`);
  return result.data;
}

export const holdingData: HoldingData = loadHolding();
/** Every plot id of every layout: a named plot is a station with that id, and its basket is `basket:<id>`. */
const PLOT_IDS: ReadonlySet<string> = new Set(holdingData.layouts.flatMap((l) => l.plots.map((p) => p.id)));

/** A station id a holding request may name: a station of stations.json, or a plot of a layout (its station once named). */
export function isHoldingStationId(value: unknown): value is string {
  return typeof value === 'string' && (STATION_BY_ID.has(value) || PLOT_IDS.has(value));
}

/** Whether an id is a layout's plot (`plot-1` …). */
export function isPlotId(value: unknown): value is string {
  return typeof value === 'string' && PLOT_IDS.has(value);
}
/** The most time away a station keeps earning (data, never code). */
export const OFFLINE_CAP_MS: number = holdingData.offlineCapHours * 60 * 60 * 1000;
/** How often the open holding scene calls GET /api/holding. */
export const HOLDING_HEARTBEAT_MS: number = holdingData.heartbeatMs;
/** How far past the layout's edges the camera may scroll (tiles), on every side (M2 Task 4b: the HUD never covers Kesh's rock). */
export const HOLDING_CAMERA_MARGIN_TILES: number = holdingData.cameraMarginTiles;
/** Every Kindled's holding today: the one layout. */
export const HOLDING_LAYOUT_ID: string = holdingData.layouts[0]?.id ?? 'first-holding';

export function holdingLayout(id: string = HOLDING_LAYOUT_ID): HoldingLayout {
  const layout = holdingData.layouts.find((l) => l.id === id);
  if (!layout) throw new Error(`no holding layout ${id}`);
  return layout;
}

/** The layout as the shore tile rule reads it: a template whose stations are ground (the props stand on it) and whose edge is the void. */
export function holdingTemplate(layout: HoldingLayout = holdingLayout()): TileTemplate {
  return { name: layout.id, tiles: layout.tiles };
}

/**
 * The layout as the sim walks it: every station tile a pillar (`o`), solid
 * like the edge; a reserved spot stays ground; the signposts of the named
 * plots (`solidPlots`, by id) are pillars too, an unnamed plot's stays ground;
 * and so is every tile of `solidTiles` (the pieces standing in the plots, M2
 * Task 6).
 */
export function holdingRoomTiles(
  layout: HoldingLayout = holdingLayout(),
  solidPlots: readonly string[] = [],
  solidTiles: readonly TilePoint[] = [],
): string[] {
  const posts = new Set([
    ...layout.plots.filter((p) => solidPlots.includes(p.id)).map((p) => `${p.station.rect.col},${p.station.rect.row}`),
    ...solidTiles.map((t) => `${t.col},${t.row}`),
  ]);
  return layout.tiles.map((row, r) =>
    row
      .split('')
      .map((ch, c) => (STATION_LETTERS.includes(ch) || posts.has(`${c},${r}`) ? 'o' : ch))
      .join(''),
  );
}

/** A station's parts in a layout, by id (none for a station the layout lacks). */
export function stationParts(layout: HoldingLayout, stationId: string): readonly StationPart[] {
  return layout.stations.find((s) => s.id === stationId)?.parts ?? [];
}

/** A layout's plot by id, or undefined. */
export function layoutPlot(layout: HoldingLayout, plotId: string): LayoutPlot | undefined {
  return layout.plots.find((p) => p.id === plotId);
}

/** A plot's index in its layout (what `plotLine` reads), or -1. */
export function plotIndex(layout: HoldingLayout, plotId: string): number {
  return layout.plots.findIndex((p) => p.id === plotId);
}

/** The start tile of a layout (its one `P`). */
export function holdingStart(layout: HoldingLayout = holdingLayout()): TilePoint {
  for (const [r, row] of layout.tiles.entries()) {
    const c = row.indexOf(HOLDING_START);
    if (c >= 0) return { col: c, row: r };
  }
  throw new Error(`layout ${layout.id} has no start`);
}
