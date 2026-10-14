/**
 * The per-username login throttle (docs/design/accounts.md): after
 * `maxFailures` failed logins for one username within `windowMs`, further
 * attempts for it are refused for `lockMs`, whatever address they come from,
 * with the same answer as a wrong password. It sits beside the per-IP rate
 * limit, which can't stop one account being guessed at from many addresses.
 *
 * In memory, like the IP limits (one server process for now); usernames
 * that don't exist count too, so the throttle says nothing about which do.
 */
export interface LoginThrottleOptions {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
  /**
   * Bound on tracked usernames: past it the least recently failed unlocked one
   * is forgotten, so a spray of made-up names can't grow memory or lift a lock.
   */
  maxTracked?: number;
}

export const DEFAULT_LOGIN_THROTTLE: LoginThrottleOptions = {
  maxFailures: 10,
  windowMs: 15 * 60_000,
  lockMs: 15 * 60_000,
};

interface Entry {
  /** Times (ms) of the failures still inside the window, oldest first. */
  failures: number[];
  lockedUntil: number;
}

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly maxTracked: number;

  constructor(private readonly opts: LoginThrottleOptions) {
    this.maxTracked = opts.maxTracked ?? 50_000;
  }

  /** Whether attempts for `username` are refused at `now`. */
  isLocked(username: string, now: number): boolean {
    const e = this.entries.get(username);
    if (!e) return false;
    if (now < e.lockedUntil) return true;
    if (this.recent(e, now).length === 0) this.entries.delete(username);
    return false;
  }

  /** Count a failed login; the username locks on its `maxFailures`th failure inside the window. */
  fail(username: string, now: number): void {
    const e = this.entries.get(username) ?? { failures: [], lockedUntil: 0 };
    // Re-inserting moves it to the end: the Map's order is least recently failed first.
    this.entries.delete(username);
    e.failures = [...this.recent(e, now), now];
    if (e.failures.length >= this.opts.maxFailures) {
      e.lockedUntil = now + this.opts.lockMs;
      e.failures = [];
    }
    this.entries.set(username, e);
    if (this.entries.size > this.maxTracked) this.forgetOne(now);
  }

  /** Forget the least recently failed username that isn't locked (a flood of names can't lift a lock). */
  private forgetOne(now: number): void {
    let oldest: string | undefined;
    for (const [name, e] of this.entries) {
      oldest ??= name;
      if (now >= e.lockedUntil) {
        this.entries.delete(name);
        return;
      }
    }
    if (oldest !== undefined) this.entries.delete(oldest);
  }

  /** A successful login clears the username's failures. */
  succeed(username: string): void {
    this.entries.delete(username);
  }

  get size(): number {
    return this.entries.size;
  }

  private recent(e: Entry, now: number): number[] {
    return e.failures.filter((t) => now - t < this.opts.windowMs);
  }
}
