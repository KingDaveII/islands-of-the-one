# Deploying

Staging runs on a single VPS as a Docker Compose stack behind Caddy. Every push to `main` that passes
CI is built, pushed to GHCR and deployed automatically. Production is not set up yet.

```
            ┌──────────────────────── VPS: /opt/islands (compose project "islands") ────────────────────────┐
 browser ──▶│ caddy :80/:443(+udp) ──▶ /api/*, /matchmake/*, /health, WebSockets ──▶ server :2567 ──▶ postgres │
            │                     └──▶ everything else ──────────────────────────▶ client :80 (nginx)        │
            │ backup: nightly pg_dump 03:00 UTC, 7 days kept                                              │
            └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Client and server share one origin (`https://$STAGING_DOMAIN`), so the deployed client connects to
`wss://<same host>` and no CORS is involved. (The server only adds CORS headers when
`NODE_ENV` is not `production`, for local dev where Vite and the server are on different ports.)

The account API (`/api/*`, [`design/accounts.md`](design/accounts.md)) relies on that one origin:
its session cookie is same-origin, and mutating routes refuse an `Origin` that doesn't match the
`Host` Caddy passes through unchanged. With `NODE_ENV=production` the server marks the cookie
`Secure` and trusts `X-Forwarded-For` from private-range peers (Caddy on the compose network; the
server publishes no port) for the per-IP login/register rate limits; `TRUST_PROXY` overrides that.
Accounts need no secrets: sessions are random tokens stored hashed, passwords are argon2id hashes.

## Files

| File                                   | Purpose                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `docker/compose.staging.yml`           | caddy, client, server, postgres 16 (named volume), backup                        |
| `docker/Caddyfile`                     | `{$STAGING_DOMAIN}` with automatic HTTPS and the routing above                   |
| `docker/deploy.sh`                     | runs on the VPS: `pull` + `up -d` (`--login`, `--no-pull`, `--status`, `--logs`) |
| `.github/workflows/deploy-staging.yml` | build + push images, upload the files above, deploy, wait for `/health`          |
| `.github/workflows/release.yml`        | on a published release, retag that commit's images as `vX.Y.Z` and `latest`      |

## Images

| Image                                          | Tags                                               |
| ---------------------------------------------- | -------------------------------------------------- |
| `ghcr.io/kingdaveii/islands-of-the-one-server` | `<full commit sha>`, `staging`, `vX.Y.Z`, `latest` |
| `ghcr.io/kingdaveii/islands-of-the-one-client` | same                                               |

Staging always runs a pinned SHA (`IMAGE_TAG` in `/opt/islands/deploy.env`); `staging` is a moving
pointer for humans. `/health` returns `{"status":"ok","version":"<sha>",...}`, which the deploy job
checks before it reports success. Images are built for `linux/amd64`.

The client shows its build bottom right of the start and account screens, `build <sha7> · <UTC date>`
(`build dev` in `pnpm dev`), from the `APP_VERSION` and `BUILD_TIME` arguments the workflow passes to the
client image, plus ` · server <sha7>` when `/health` names another build: after a deploy the label
should show the new SHA alone, and a `server` part means the two images are out of step.

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
| secret   | `STAGING_DOMAIN`     | e.g. `203-0-113-7.sslip.io`                                              |
| secret   | `DEPLOY_HOST`        | SSH host (the staging domain, or the VPS address)                        |
| variable | `DEPLOY_USER`        | `deploy`                                                                 |
| secret   | `DEPLOY_PORT`        | SSH port                                                                 |
| secret   | `DEPLOY_SSH_KEY`     | private key (OpenSSH format) for `DEPLOY_USER`                           |
| secret   | `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -p <port> <host>` output; strict host checking is always on |

**The repo is public, and so are its Actions logs.** The staging domain names the VPS address
(sslip.io), so `STAGING_DOMAIN` and `DEPLOY_HOST` are secrets: GitHub masks them wherever they show
up in a log, and the workflow keeps them out of step names, `echo`s and the environment URL. Never
add them as variables, which anyone can read. `deploy.env` carries the domain to the VPS for Caddy
but is never printed. On a failed deploy the Diagnostics step shows `compose ps` only: server and
Caddy logs contain visitors' IP addresses, so read them on the VPS (`deploy.sh --logs`).

`DEPLOY_USER` is a variable because a secret's value is masked everywhere in the logs, which turned
every "deploy" into `***`; a secret of the same name still works as a fallback. The "Configure SSH"
step logs whether the SSH host is the staging domain, without printing either.

No registry PAT is needed: workflows push with `GITHUB_TOKEN` (`packages: write`), and the deploy job
passes the same short-lived token to `deploy.sh --login` over stdin; `deploy.sh` logs the VPS into
`ghcr.io`, pulls, and logs out again when it exits. The packages stay private and are linked to this
repository.

## Deploy flow

1. `CI` passes on a push to `main` → `Deploy staging` starts (`workflow_run`).
2. Build both images, push `:<sha>` and `:staging`.
3. Write `deploy.env` (`SERVER_IMAGE`, `CLIENT_IMAGE`, `IMAGE_TAG=<sha>`, `STAGING_DOMAIN`) and `scp`
   it with `compose.staging.yml`, `Caddyfile` and `deploy.sh` to `/opt/islands`.
4. `deploy.sh --login <actor>` in one SSH session, token on stdin: it takes `/opt/islands/.deploy.lock`,
   logs in to `ghcr.io`, runs `compose pull` and `compose up -d --remove-orphans`, and logs out on exit.
   The server applies pending migrations on start.
5. Poll `https://$STAGING_DOMAIN/health` for up to 5 minutes until it reports `ok` **and** the new
   SHA; otherwise the job fails and prints `compose ps`.

Deploys are serialized (`concurrency: deploy-staging`).

**Dropped connections.** The upload (step 3) and the start (step 4) are retried when `scp`/`ssh`
reports a connection failure (exit 255): up to 3 retries, 5, 10 and 20 s apart, each logged as a
warning on the run. Any other failure, such as a failed `compose pull`, fails the job at once. A
retried start waits on `.deploy.lock` (up to 10 minutes) if the dropped session's `deploy.sh` is
still running on the VPS, so two starts never overlap. The VPS needs `flock` (util-linux).

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
