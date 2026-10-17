import { api, type ApiResult } from '../api.js';
import type { HealthResponse } from '@iot/shared';

/**
 * The build label on the start and account screens (G1.5i), so a playtest
 * can tell an old deploy from a new one: `build 8443ba3 · 2026-10-17 12:40`,
 * the client's commit and when its image was built (UTC), `build dev` in
 * `pnpm dev`; and ` · server 19ef73d` when the server's build (its /health)
 * is known and differs, which is exactly what a half-deployed stack looks
 * like. Vite bakes the client's in (`VITE_BUILD_SHA`, `VITE_BUILD_TIME`, from
 * the image's `APP_VERSION` and `BUILD_TIME` build arguments; docs/DEPLOY.md).
 * Nothing secret goes in.
 */
export interface ClientBuild {
  /** The full commit SHA; null for a dev build. */
  sha: string | null;
  /** When it was built, ISO 8601; null when unknown. */
  builtAt: string | null;
}

/** The build Vite baked in: a blank or `dev` SHA is a dev build. */
export function clientBuild(env: {
  VITE_BUILD_SHA?: string;
  VITE_BUILD_TIME?: string;
}): ClientBuild {
  const sha = env.VITE_BUILD_SHA?.trim() ?? '';
  const builtAt = env.VITE_BUILD_TIME?.trim() ?? '';
  return { sha: sha && sha !== 'dev' ? sha : null, builtAt: builtAt || null };
}

/** A build on the label: the first 7 characters of its SHA, or `dev`. */
export function shortBuild(sha: string | null): string {
  return sha && sha !== 'dev' ? sha.slice(0, 7) : 'dev';
}

/** An ISO 8601 time as `YYYY-MM-DD HH:MM` in UTC; null when it doesn't parse. */
export function buildDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
}

/**
 * The label's text: the client's build and date, then the server's build
 * when it is known (`server`, from /health) and not the same build. Only
 * characters the pixel fonts draw (`·` is in both atlases).
 */
export function buildLabelText(client: ClientBuild, server: string | null): string {
  const parts = [`build ${shortBuild(client.sha)}`];
  const date = client.sha ? buildDate(client.builtAt) : null;
  if (date) parts.push(date);
  if (server !== null && server !== (client.sha ?? 'dev'))
    parts.push(`server ${shortBuild(server)}`);
  return parts.join(' · ');
}

/** What `window.__iot.build` shows: the client's build, the server's once known, and the label. */
export interface BuildSnapshot extends ClientBuild {
  server: string | null;
  label: string;
}

export interface BuildStore {
  /** Asks the server its build once; a server that can't be reached leaves the label the client's alone, without an error. */
  ask(): Promise<void>;
  snapshot(): BuildSnapshot;
  /** Called when the server's build comes in; returns the unsubscribe. */
  subscribe(fn: () => void): () => void;
}

export function createBuildStore(
  client: ClientBuild,
  health: () => Promise<ApiResult<HealthResponse>>,
): BuildStore {
  let server: string | null = null;
  let asked: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  return {
    ask() {
      asked ??= health().then((res) => {
        if (!res.ok) return;
        server = res.value.version;
        for (const fn of listeners) fn();
      });
      return asked;
    },
    snapshot: () => ({ ...client, server, label: buildLabelText(client, server) }),
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/** This client's build, and the server's once /health has answered. */
export const buildStore: BuildStore = createBuildStore(clientBuild(import.meta.env), () =>
  api.health(),
);
