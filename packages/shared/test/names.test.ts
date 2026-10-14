import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANNED, HEBREW, LATIN } from './banned.js';

/**
 * The banned names in docs/design/glossary.md (the matcher is in banned.ts),
 * checked in every file of the repo (tracked or new, not ignored): its path
 * and its text.
 */

/** Third-party content whose random base64 hashes could match by chance; only the path is checked. */
const PATH_ONLY = new Set(['pnpm-lock.yaml']);

const root = fileURLToPath(new URL('../../../', import.meta.url));

function repoFiles(): string[] {
  const args = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
  const out = execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  return out.split('\0').filter((f) => f !== '' && existsSync(root + f));
}

describe('banned names (docs/design/glossary.md)', () => {
  it('the matcher finds each form in any case, inside identifiers', () => {
    for (const name of LATIN) {
      expect(BANNED.test(`item_${name.toUpperCase()}Blade`), name).toBe(true);
    }
    for (const name of HEBREW) {
      // With a vowel point between every two letters.
      expect(BANNED.test(name.replaceAll('[\\u0591-\\u05c7]*', '\u05b8')), name).toBe(true);
    }
    expect(BANNED.test('the One, the Hollow, Sparkglass, hookblade')).toBe(false);
  });

  it('appear in no file path or text in the repo', () => {
    const hits: string[] = [];
    for (const file of repoFiles()) {
      if (BANNED.test(file)) hits.push(file);
      if (PATH_ONLY.has(file)) continue;
      const bytes = readFileSync(root + file);
      if (bytes.includes(0)) continue; // binary (images, fonts)
      for (const [i, line] of bytes.toString('utf8').split('\n').entries()) {
        if (BANNED.test(line)) hits.push(`${file}:${i + 1}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
