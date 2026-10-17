/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string;
  /** The client's build: the full commit SHA (from the image's APP_VERSION) and its build time, ISO 8601 UTC. Unset in `pnpm dev`. */
  readonly VITE_BUILD_SHA?: string;
  readonly VITE_BUILD_TIME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
