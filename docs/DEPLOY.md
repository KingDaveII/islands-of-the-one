# Deploying

Staging runs on a single VPS as a Docker Compose stack behind Caddy. Every push to `main` that passes
CI is built, pushed to GHCR and deployed automatically. Production is not set up yet.

```
            ┌──────────────────────── VPS: /opt/islands (compose project "islands") ────────────────────────┐
 browser ──▶│ caddy :80/:443(+udp) ──▶ /matchmake/*, /health, WebSocket upgrades ──▶ server :2567 ──▶ postgres │
            │                     └──▶ everything else ──────────────────────────▶ client :80 (nginx)        │
            │ backup: nightly pg_dump 03:00 UTC, 7 days kept                                              │
            └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Client and server share one origin (`https://$STAGING_DOMAIN`), so the deployed client connects to
`wss://<same host>` and no CORS is involved. (The server only adds CORS headers when
`NODE_ENV` is not `production`, for local dev where Vite and the server are on different ports.)

## Files

| File                                   | Purpose                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `docker/compose.staging.yml`           | caddy, client, server, postgres 16 (named volume), backup                     |
| `docker/Caddyfile`                     | `{$STAGING_DOMAIN}` with automatic HTTPS and the routing above                |
| `docker/deploy.sh`                     | runs on the VPS: `pull` + `up -d` (`--no-pull`, `--status`, `--logs` for ops) |
| `.github/workflows/deploy-staging.yml` | build + push images, upload the files above, deploy, wait for `/health`       |
| `.github/workflows/release.yml`        | on a published release, retag that commit's images as `vX.Y.Z` and `latest`   |

## Images

| Image                                          | Tags                                               |
| ---------------------------------------------- | -------------------------------------------------- |
| `ghcr.io/kingdaveii/islands-of-the-one-server` | `<full commit sha>`, `staging`, `vX.Y.Z`, `latest` |
| `ghcr.io/kingdaveii/islands-of-the-one-client` | same                                               |

Staging always runs a pinned SHA (`IMAGE_TAG` in `/opt/islands/deploy.env`); `staging` is a moving
pointer for humans. `/health` returns `{"status":"ok","version":"<sha>",...}`, which the deploy job
checks before it reports success. Images are built for `linux/amd64`.

## Server prerequisites (one-time)

- Docker Engine with the Compose v2 plugin (≥ 2.17, for multiple `--env-file`s).
- A `deploy` user in the `docker` group. Its SSH key may be restricted (`restrict`/`no-pty`, …):
  the workflow only uses `scp` and non-interactive `ssh host 'command'`.
- SSH on a non-default port, reachable from GitHub-hosted runners.
- `/opt/islands` owned by `deploy`, containing `.env` with `POSTGRES_PASSWORD=...` (`chmod 600`).
  The workflow never writes or reads this file; keep it out of git.
- Ports 80/tcp, 443/tcp and 443/udp free for Caddy (nothing else in this stack publishes ports;
  Postgres is only reachable on the compose network).
- `STAGING_DOMAIN` resolves to the VPS (an `<ip>.sslip.io` name does this automatically).

The VPS also runs unrelated containers. This stack uses the compose project name `islands`, sets no
`container_name`s and only touches its own volumes (`islands_pgdata`, `islands_pgbackups`,
`islands_caddy_data`, `islands_caddy_config`). `deploy.sh` runs `docker image prune -f`, which only
removes dangling images.

## GitHub configuration

Environment **`staging`** (Settings → Environments):

| Kind     | Name                 | Value                                                                    |
| -------- | -------------------- | ------------------------------------------------------------------------ |
| secret   | `DEPLOY_HOST`        | VPS hostname or IP                                                       |
| secret   | `DEPLOY_USER`        | `deploy`                                                                 |
| secret   | `DEPLOY_PORT`        | SSH port                                                                 |
| secret   | `DEPLOY_SSH_KEY`     | private key (OpenSSH format) for `DEPLOY_USER`                           |
| secret   | `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -p <port> <host>` output; strict host checking is always on |
| variable | `STAGING_DOMAIN`     | e.g. `203-0-113-7.sslip.io`                                              |

No registry PAT is needed: workflows push with `GITHUB_TOKEN` (`packages: write`), and the deploy job
logs the VPS into `ghcr.io` with the same short-lived token over stdin, then `deploy.sh` logs out
again after pulling. The packages stay private and are linked to this repository.

## Deploy flow

1. `CI` passes on a push to `main` → `Deploy staging` starts (`workflow_run`).
2. Build both images, push `:<sha>` and `:staging`.
3. Write `deploy.env` (`SERVER_IMAGE`, `CLIENT_IMAGE`, `IMAGE_TAG=<sha>`, `STAGING_DOMAIN`) and `scp`
   it with `compose.staging.yml`, `Caddyfile` and `deploy.sh` to `/opt/islands`.
4. `docker login ghcr.io`, then `deploy.sh`: `compose pull`, logout, `compose up -d --remove-orphans`.
   The server applies pending migrations on start.
5. Poll `https://$STAGING_DOMAIN/health` for up to 5 minutes until it reports `ok` **and** the new
   SHA; otherwise the job fails and prints `compose ps` + recent server/caddy logs.

Deploys are serialized (`concurrency: deploy-staging`).

## Rolling back

**Preferred — re-deploy an earlier build:** Actions → **Deploy staging** → _Run workflow_ on `main`,
and set `sha` to the full commit SHA to roll back to (any commit on `main` that was deployed before;
see the workflow history or `git log`). This skips the build, checks both `:<sha>` images exist,
moves `:staging` to them, deploys and waits for `/health` to report that SHA. Compose/Caddy config
comes from current `main`; only the images change.

**From the VPS (GitHub unavailable):** images of recent deploys are still on the host.

```sh
cd /opt/islands
docker images 'ghcr.io/kingdaveii/islands-of-the-one-server'   # pick a SHA that is present
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<sha>/' deploy.env
./deploy.sh --no-pull
curl -fsS https://$(grep ^STAGING_DOMAIN= deploy.env | cut -d= -f2)/health
```

The next push to `main` deploys forward again.

**Database:** rolling back code does not roll back migrations. Migrations should stay backward
compatible with the previous release (expand → migrate → contract). If data must be restored, use a
backup.

## Backups

The `backup` service writes `game-<UTC timestamp>.dump` (`pg_dump --format=custom`) to the
`islands_pgbackups` volume every night at 03:00 UTC and deletes dumps older than 7 days.

```sh
cd /opt/islands
c() { docker compose -f compose.staging.yml --env-file .env --env-file deploy.env "$@"; }
c exec backup ls -l /backups                                   # list
c exec backup sh -c 'pg_dump -Fc -f /backups/game-manual.dump'  # take one now
c stop server                                                   # restore:
c exec backup pg_restore --clean --if-exists --no-owner -d game /backups/<file>.dump
c start server
# copy off the host:
c cp backup:/backups/<file>.dump ./
```

## Releases

Publishing a GitHub release with tag `vX.Y.Z` on a commit from `main` retags that commit's images as
`vX.Y.Z` and `latest` (no rebuild). The release fails if the commit was never built by
`Deploy staging`. Nothing is deployed to production yet.
