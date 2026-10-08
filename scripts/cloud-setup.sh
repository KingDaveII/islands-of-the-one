#!/usr/bin/env bash
# SessionStart hook for Claude Code on the web. No-op everywhere else.
# Idempotent: safe (and fast) to re-run on every startup/resume.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}"

DB_USER=game
DB_PASS=game
DB_NAME=game

# --- Postgres -------------------------------------------------------------
if ! pg_isready -q -h localhost -p 5432 2>/dev/null; then
  service postgresql start >/dev/null
  for _ in $(seq 1 30); do
    pg_isready -q -h localhost -p 5432 && break
    sleep 0.5
  done
fi

as_postgres() {
  if [ "$(id -un)" = "postgres" ]; then "$@"; else su postgres -c "$(printf '%q ' "$@")"; fi
}

if [ "$(as_postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]; then
  as_postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'"
fi
if [ "$(as_postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
  as_postgres psql -qc "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"
fi

# --- Node dependencies ----------------------------------------------------
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" >/dev/null
fi

# Skip the install entirely when the lockfile hasn't changed since last run.
stamp=node_modules/.cloud-setup-lock-hash
hash=$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$hash" ]; then
  pnpm install --frozen-lockfile --prefer-offline
  echo "$hash" >"$stamp"
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -q '^export DATABASE_URL=' "$CLAUDE_ENV_FILE" 2>/dev/null; then
  echo "export DATABASE_URL=${DATABASE_URL:-postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}}" >>"$CLAUDE_ENV_FILE"
fi
