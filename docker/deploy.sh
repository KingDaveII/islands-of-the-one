#!/usr/bin/env bash
# Runs on the VPS from the deploy directory (/opt/islands). Uploaded by
# .github/workflows/deploy-staging.yml together with compose.staging.yml,
# Caddyfile and deploy.env.
#
#   ./deploy.sh               pull images for IMAGE_TAG (deploy.env) and start
#   ./deploy.sh --login USER  the same, logging in to ghcr.io first with a token
#                             read from stdin, and logging out again on exit
#   ./deploy.sh --no-pull     start with images already on the host (manual rollback)
#   ./deploy.sh --status      show service status
#   ./deploy.sh --logs [n]    last n lines (default 100) of the server and caddy logs
#
# Deploys hold .deploy.lock, so a deploy that the workflow retries after a
# dropped SSH connection waits for the one that may still be running here
# instead of racing it (and its logout).
set -euo pipefail
cd "$(dirname "$0")"

compose() {
  docker compose -f compose.staging.yml --env-file .env --env-file deploy.env "$@"
}

usage() {
  echo "usage: $0 [--login USER|--no-pull|--status|--logs [n]]" >&2
  exit 2
}

lock() {
  exec 9>.deploy.lock
  flock -w 600 9 || {
    echo "another deploy still holds $(pwd)/.deploy.lock after 10 minutes" >&2
    exit 1
  }
}

pull=1
case "${1:-}" in
  --status)
    compose ps
    exit 0
    ;;
  --logs)
    compose logs --tail "${2:-100}" server caddy
    exit 0
    ;;
  --no-pull)
    pull=0
    lock
    ;;
  --login)
    [ -n "${2:-}" ] || usage
    lock
    # The workflow's GITHUB_TOKEN expires with the job; don't leave it behind.
    trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
    docker login ghcr.io -u "$2" --password-stdin
    ;;
  '')
    lock
    ;;
  *)
    usage
    ;;
esac

if [ "$pull" -eq 1 ]; then
  compose pull
fi
compose up -d --remove-orphans
docker image prune -f >/dev/null
compose ps
