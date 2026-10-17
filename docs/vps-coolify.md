# Self-hosting on a VPS with Coolify

A step-by-step path for running the supastack web app on a single cheap VPS
managed by Coolify — a self-hosted PaaS that handles Docker builds, reverse
proxy, TLS, and scheduled tasks. This is the "no Vercel/Railway" option:
everything below runs on hardware you rent. `docs/deployment.md` covers the
general topology; this guide is the concrete walkthrough. Read
[`docs/agent-security.md`](agent-security.md) for credential handling and the
acceptance checks before calling a deployment ready.

## Sizing

Coolify's documented minimum is 2 CPU cores, 2 GB RAM, 10 GB free disk
(amd64 or arm64). That describes Coolify running — not building or serving
your app on the same box; ~30 GB is the practical floor once Docker images,
build cache, and your app share the disk.

The build decision matters more than the box:

- **Build on the VPS.** The root `Dockerfile` copies `packages/` + `apps/web`
  and runs `pnpm install --frozen-lockfile` for the whole web workspace
  closure (mobile and desktop are not in the image), then
  `pnpm --filter @supastack/web build` (Next.js standalone) inside the image
  build. Budget ~4 GB of RAM on the box for a comfortable `next build`; ~2 GB
  is the floor, and then you want swap plus a
  `NODE_OPTIONS=--max-old-space-size=2048` cap. The Dockerfile does not declare
  `ARG NODE_OPTIONS` today — set it as a Coolify build variable (Coolify
  injects build variables into the Dockerfile as `ARG` statements by default)
  and confirm it reaches the `RUN` step in the build log, or add
  `ARG NODE_OPTIONS` to the build stage yourself.
- **Build elsewhere, deploy the image (cheaper).** Build in CI (e.g. GitHub
  Actions → GHCR) and have Coolify deploy the prebuilt image. Then a ~1–2 GB
  VPS only _runs_ the standalone Node server — figure roughly 150–300 MB RSS
  for the process (estimate, not a benchmark) — leaving room for Postgres and
  Coolify itself.

A €4–5/mo Hetzner/Contabo-class 2-vCPU/4 GB box covers the build-on-box path;
the prebuilt path is what makes the ~1–2 GB tiers viable.

## Install Coolify

1. Provision a fresh VPS (Ubuntu LTS or Debian) and SSH in as root — the
   installer needs it.
2. Open firewall ports: `22` (SSH), `80`/`443` (web traffic + Let's Encrypt),
   `8000` (dashboard), `6001`/`6002` (realtime UI + web terminal on direct IP).
   Once the dashboard sits behind a domain through the proxy you can close
   `8000`/`6001`/`6002` publicly.
3. Run the official installer:

   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

4. Open `http://<server-ip>:8000`, create the admin account, and create a
   project + environment (e.g. `production`).

## Postgres

Two options:

- **Coolify-managed Postgres on the same VPS** — cheapest. Add a database
  resource from the service catalog; copy its private connection string into
  `DATABASE_URL` (app and DB share the Docker network). Use unique production
  credentials; `supastack:supastack` is a local Compose example only. Backups are your job:
  schedule `pg_dump` (server cron or a scheduled task) — a Docker volume is
  not a backup. The DB also shares the box's RAM; on the smallest tiers that's
  the second argument for the prebuilt-image path.
- **Managed Postgres** (Supabase, Neon, etc.) — the provider handles backups
  and pooling; costs a little but frees RAM on the box. See
  `/docs/deploy/supabase-cloud` for the Supabase notes.

## Environment

All configuration is runtime-only — the image builds with no env or secrets
(the Dockerfile declares no `ARG`s and bakes no `.env`), so set variables in
Coolify's Environment Variables UI before deploying. Each variable has a
"Build Variable" and a "Runtime Variable" checkbox (both on by default):
keep "Build Variable" off for secrets — build args are recoverable from
image metadata.

Minimum set:

- `APP_URL` — the final public https origin. In production it must be an
  exact, non-local HTTPS origin (scheme + host, no path); it drives auth
  trusted origins and canonical/OG URLs.
- `DATABASE_URL`, `AUTH_SECRET`.
- With `APP_ENV=production` the config additionally requires
  `EXPO_PUBLIC_API_URL` (set it equal to `APP_URL` for a web-only deploy),
  `EXPO_PUBLIC_APP_SCHEME` (a mobile deep-link scheme — a web-only deploy can
  set any valid scheme value, e.g. `supastack`), `MOBILE_ALLOWED_ORIGINS`
  (comma-separated absolute HTTPS origins — use your app origin if you don't
  ship the mobile app), and `CREDENTIAL_ENCRYPTION_KEY`.

Provider selectors (`AI_PROVIDER`, `BILLING_PROVIDER`, `EMAIL_PROVIDER`,
`JOB_PROVIDER`, `STORAGE_PROVIDER`) default to `local`/`fake`/`memory` — the
app boots without paid credentials. `.env.example` is the full inventory.
Server secrets never get `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefixes.

## Migrations

The production image ships only `.next/standalone` — drizzle-kit is **not** in
it, so you cannot `docker exec` a migrate inside the container. Keep a
Coolify-managed database private and run a one-shot Node 22 migrator from a
repo checkout on the Coolify deployment server, attached to the same Docker
network. The default standalone-server destination network is `coolify`; if
the database uses another destination, set `COOLIFY_NETWORK` to its actual
shared network name. Start the database resource and confirm it is healthy
before running migrations.

```bash
COOLIFY_NETWORK=coolify
docker network inspect --format '{{.Name}} driver={{.Driver}} attachable={{.Attachable}}' "$COOLIFY_NETWORK"
docker ps --format 'table {{.Names}}\t{{.Networks}}'
```

Confirm the database is attached to this network and set the app's Coolify
destination to the same one. Coolify's default `coolify` network is attachable.
A standalone container can join a bridge network even if `Attachable` is
false; an overlay network must be attachable. Use the database's **Postgres
URL (internal)** from Coolify's saved resource configuration. On the Coolify
host, check out this repository using its public remote or an existing deploy
key; never embed a repository token in a clone URL.

Create a temporary env file with mode `600`, then have the secret manager
materialize only the configured internal `DATABASE_URL` into it as a single
`DATABASE_URL=...` assignment. Do not print the URL, put it in a command,
shell history, `export`, or the agent report. If the secret manager cannot
write a protected file on the deployment host, stop and mark migration
`BLOCKED` until an operator provides a safe injection path.

From the repository root on the Coolify host, run the migrator. It does not
require host Node.js and does not expose database port `5432`:

```bash
umask 077
migration_env=$(mktemp)
trap 'rm -f "$migration_env"' EXIT
```

Have the secret manager materialize the saved internal `DATABASE_URL` as the
only assignment in the file named by `$migration_env`, then enforce mode
`600`. The container checks that the variable exists before running Corepack,
so an empty file cannot fall back to the checkout `.env`. Run the migrator from
the same shell session:

```bash
chmod 600 "$migration_env"
docker run --rm --network "$COOLIFY_NETWORK" --env-file "$migration_env" \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -v "$PWD":/app -v coolify-pnpm-store:/root/.local/share/pnpm/store \
  -w /app node:22-bookworm-slim sh -c \
  ': "${DATABASE_URL:?Inject the production DATABASE_URL through the protected migration env file}" && corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @supastack/db db:migrate'
```

The temporary env file contains only `DATABASE_URL`; the database host in the
internal URL must resolve on `$COOLIFY_NETWORK`. If using a database reachable
from an external Node 22 checkout or CI runner instead, inject its production
URL through that runner's protected env file and run the same `pnpm install`
and `db:migrate` commands there. Do not open a private database port merely
to make a local checkout reach it.

Do this before the first deploy and after every upgrade that ships new
migrations in `packages/db/drizzle/`.

## Deploy the app

1. In the project: **Add resource → Application**, then pick the repo source —
   public repository URL, or private via the Coolify GitHub App / deploy key.
   (Coolify v4.3.0+ ships a redesigned UI — expect slight label drift from
   the "Add Resource" wording here and below.)
2. Set the build pack to **Dockerfile** (Coolify defaults to Nixpacks —
   change it). Dockerfile location `/Dockerfile`, base directory `/`.
3. Set the port to **8080** — the image `EXPOSE`s 8080 and runs
   `node apps/web/server.js` from `.next/standalone` (Coolify's default is
   3000). The field is **Ports Exposes** (Configuration → General);
   alternatively suffix the domain — `https://yourdomain.com:8080`.
4. Configure the health check path **`/api/health`** under the application's
   Healthcheck settings (the Dockerfile ships no `HEALTHCHECK` of its own).
   Caveat: Coolify's HTTP healthcheck runs _inside_ the container and needs
   `curl` or `wget` present — `node:22-alpine` ships BusyBox `wget`, so it
   works today, but rebasing the image to distroless or a slim variant
   without `wget` silently breaks the check and can mark the container
   unhealthy.
5. Deploy and read the build log once — confirm `pnpm install`, the
   `next build` stage, and a green health check.

For the prebuilt path, choose **Docker Image** as the resource type instead and
point it at your registry image (`ghcr.io/<org>/<image>:<tag>`). Builds stop
happening on the VPS entirely.

## Domain and TLS

Set the application's domain in Coolify (or accept the generated one).
Coolify's proxy provisions a Let's Encrypt certificate automatically — port 80
must stay reachable for issuance/renewal. `APP_URL` must equal the final public
URL exactly.

## Background jobs

`JOB_PROVIDER` picks how recurring work ticks:

- **`local` (default):** create a Coolify Scheduled Task on the application
  (Configuration → Scheduled Tasks) that POSTs the internal tick endpoint. The
  command runs via `sh` inside the app container — `node` is present and the
  env is loaded:

  ```bash
  node -e "fetch('http://127.0.0.1:8080/api/internal/scheduler-tick',{method:'POST',headers:{'x-scheduler-key':process.env.SCHEDULER_TICK_SECRET}}).then(r=>process.exit(r.ok?0:1))"
  ```

  Frequency `* * * * *` (every minute — the cadence `scheduler.tick` uses under
  Trigger.dev); the named schedule `every_minute` is the equivalent pick —
  `@every_minute` is _not_ valid syntax. One malformed expression can break
  every scheduled task on the app, not just the bad one, so keep it exact.
  The default timeout is fine. Requires `SCHEDULER_TICK_SECRET`
  in the environment — the endpoint 404s while it's unset. Use **Execute Now**
  to smoke-test it.

- **`trigger`:** set `JOB_PROVIDER=trigger` with `TRIGGER_SECRET_KEY` +
  `TRIGGER_PROJECT_REF`; Trigger.dev Cloud runs the `scheduler.tick` cron
  itself, so no VPS-side task is needed.

## Storage, email, billing webhooks

- `STORAGE_PROVIDER` defaults to `memory` — files die with the container. Set
  `s3` with any S3-compatible bucket; Coolify's service catalog can host MinIO
  on the same box (point `STORAGE_ENDPOINT` at it — path style is enabled
  automatically for custom endpoints).
- `EMAIL_PROVIDER=local` is a development-only inbox; `/mail-preview` is
  unavailable in production. Configure a real transactional provider before
  accepting production email sign-in. A successful boot does not verify mail
  delivery; do not look for authentication codes in logs.
- Once a billing provider is configured, point its dashboard webhook at
  `https://<app>/api/billing/webhook[/<provider>]` — per-provider paths and
  headers are listed in `docs/deployment.md`.

## Post-deploy verification

Run the status-based checks in [`docs/agent-setup.md`](agent-setup.md) and the
full acceptance checklist in [`docs/agent-security.md`](agent-security.md).
Health and local demo output do not prove real sign-in or cross-user workspace
isolation. Mark unavailable checks `BLOCKED` or `NOT RUN` with safe evidence;
then use `docs/real-provider-smoke.md` only for providers the user explicitly
configured.

## Limits

- `/api/v1` and auth endpoints are rate-limited through a fixed-window store;
  `RATE_LIMIT_STORE` defaults to `postgres` under `NODE_ENV=production`, so
  buckets are shared via the database. A single VPS instance needs nothing
  extra, and multi-instance shares state automatically (or put an edge limiter
  in front).
- One box = one point of failure: no failover, no zero-downtime guarantee
  during redeploys, backups on you. That's the price of cheap.
