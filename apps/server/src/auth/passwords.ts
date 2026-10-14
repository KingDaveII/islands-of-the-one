import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing: argon2id through @node-rs/argon2 (prebuilt binaries, no
 * build step; the glibc build runs in the node:22-slim image). Parameters are
 * OWASP's argon2id baseline: 19 MiB, 2 passes, 1 lane. The PHC string stores
 * them with the salt, so they can be raised later without a migration.
 */
const OPTIONS = {
  // Algorithm.Argon2id: the package exports a const enum, which isolatedModules can't inline.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** A hash of a password nobody has, verified when the username is unknown so both failures take as long. */
let dummyHash: Promise<string> | undefined;

/**
 * Check a password against a stored hash, or (no hash: unknown username)
 * against a dummy hash, so a login takes the same time either way. argon2's
 * own comparison is constant-time.
 */
export async function verifyPassword(
  hashed: string | undefined,
  password: string,
): Promise<boolean> {
  if (hashed === undefined) {
    dummyHash ??= hashPassword('not a password anyone has');
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}
