import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRecipe, type BuildResult } from './build.js';
import { PipelineError } from './errors.js';
import { parseRecipe, type Recipe } from './recipe.js';

/** The repo root, from this file's place in packages/art-pipeline/src. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const RECIPE_DIR = 'art/sheets';

/** The names of every recipe in art/sheets, sorted. */
export function recipeNames(root = REPO_ROOT): string[] {
  const dir = join(root, RECIPE_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

/** Reads and validates art/sheets/<sheet>.json. */
export function loadRecipe(sheet: string, root = REPO_ROOT): Recipe {
  const file = `${RECIPE_DIR}/${sheet}.json`;
  const abs = join(root, file);
  if (!existsSync(abs)) throw new PipelineError(`${file} does not exist`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new PipelineError(`${file} is not valid JSON: ${(e as Error).message}`);
  }
  return parseRecipe(json, file, root);
}

/** Builds a recipe and writes its outputs. Returns what it built. */
export function buildAndWrite(sheet: string, root = REPO_ROOT): BuildResult {
  const result = buildRecipe(loadRecipe(sheet, root), root);
  for (const [path, bytes] of result.outputs) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, bytes);
  }
  return result;
}

/**
 * Rebuilds every recipe in memory and compares each output with the committed
 * file, byte for byte. Returns one message per recipe that fails to build and
 * per output that is missing or differs; an empty list means everything matches.
 */
export function checkAll(root = REPO_ROOT): string[] {
  const problems: string[] = [];
  for (const sheet of recipeNames(root)) {
    let result: BuildResult;
    try {
      result = buildRecipe(loadRecipe(sheet, root), root);
    } catch (e) {
      if (!(e instanceof PipelineError)) throw e;
      problems.push(...e.problems.map((p) => `${sheet}: ${p}`));
      continue;
    }
    for (const [path, bytes] of result.outputs) {
      const abs = join(root, path);
      if (!existsSync(abs)) problems.push(`${path} is missing: run pnpm art:build ${sheet}`);
      else if (!readFileSync(abs).equals(bytes)) {
        problems.push(
          `${path} differs from what art/sheets/${sheet}.json builds: run pnpm art:build ${sheet} (never edit a built file)`,
        );
      }
    }
  }
  return problems;
}
