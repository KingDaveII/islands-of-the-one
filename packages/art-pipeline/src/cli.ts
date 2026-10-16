import { PipelineError } from './errors.js';
import { buildAndWrite, checkAll, recipeNames } from './sheets.js';

/**
 * pnpm art:build <sheet> | --all   build recipes and write their outputs
 * pnpm art:check                   rebuild every recipe in memory, fail on any difference
 */
function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === 'check') {
    const problems = checkAll();
    for (const p of problems) console.error(p);
    if (problems.length) return 1;
    console.log(`art:check: ${recipeNames().length} recipes, every output matches`);
    return 0;
  }
  if (command === 'build') {
    const sheets = rest.includes('--all') ? recipeNames() : rest.filter((a) => !a.startsWith('-'));
    if (!sheets.length) {
      console.error('usage: pnpm art:build <sheet> [<sheet>...] | --all');
      return 2;
    }
    let failed = 0;
    for (const sheet of sheets) {
      try {
        const r = buildAndWrite(sheet);
        const t = r.report.totals;
        console.log(
          `${sheet}${r.recipe.draft ? ' (draft)' : ''}: ${t.frames} frames, ${t.offPalette} off-palette px snapped, ` +
            `${t.outlineGaps} outline gaps${t.masked !== undefined ? `, ${t.masked} masked px` : ''}, ` +
            `${r.skinProblems.length} skin regions to resolve → ${[...r.outputs.keys()].join(', ')}`,
        );
      } catch (e) {
        if (!(e instanceof PipelineError)) throw e;
        failed++;
        console.error(`${sheet}: build failed`);
        for (const p of e.problems) console.error(`  ${p}`);
      }
    }
    return failed ? 1 : 0;
  }
  console.error('usage: art-pipeline build <sheet>... | --all, or art-pipeline check');
  return 2;
}

process.exitCode = main(process.argv.slice(2));
