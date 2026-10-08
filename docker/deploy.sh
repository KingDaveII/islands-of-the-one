#!/usr/bin/env bash
# Runs on the VPS from the deploy directory (/opt/islands). Uploaded by
# .github/workflows/deploy-staging.yml together with compose.staging.yml,
# Caddyfile and deploy.env.
#
#   ./deploy.sh            pull images for IMAGE_TAG (deploy.env) and start
#   ./deploy.sh --no-pull  start with images already on the host (manual rollback)
#   ./deploy.sh --status   show service status
set -euo pipefail
cd "$(dirname "$0")"

compose() {
  docker compose -f compose.staging.yml --env-file .env --env-file deploy.env "$@"
}

case "${1:-}" in
  --status)
    compose ps
    exit 0
    ;;
  --logs)
    compose logs --tail "${2:-100}" server caddy
    exit 0
    ;;
  --no-pull) ;;
  '')
    # The workflow logs in with a GITHUB_TOKEN that expires with the job;
    # don't leave it behind.
    trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT
    compose pull
    ;;
  *)
    echo "usage: $0 [--no-pull|--status|--logs [n]]" >&2
    exit 2
    ;;
esac

compose up -d --remove-orphans
docker image prune -f >/dev/null
compose ps
