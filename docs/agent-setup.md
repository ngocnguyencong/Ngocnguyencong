# Agent setup & deploy runbook

Executable playbook for an autonomous coding agent with a fresh clone and a
shell. Execute phases in order; run every verification checkpoint and report
its safe status and output. `docs/deployment.md` documents the production
topology; this file is the command sequence.

## How to use this guide (agent contract)

1. Read `llms.txt` at the repository root first — it is the repo map. Then
   read `AGENTS.md` for the non-negotiable boundaries and
   `docs/agent-security.md` for credential handling and acceptance; then
   return here.
2. Execute steps in order. After each phase, run its verification checkpoint
   and report its exit/status and safe output — not a claim. Redact secrets,
   connection strings, cookies, and session values from every report.
3. `.env.example` is the only environment inventory. Never invent variable
   names; if a setting you need is missing from `.env.example`, stop and ask.
4. Never commit `.env` files. `.gitignore` covers `.env`, `.env.*`, and
   `*.local` — verify with `git check-ignore .env` if unsure.
5. If a step fails twice, stop. Report the failing command and sanitized
   output instead of improvising around it.
6. Never disable a security feature to make an error go away: auth checks,
   Postgres RLS, and rate limits stay on. Ask before destructive operations
   (dropping volumes, overwriting an existing `.env`, wiping a database).

`pnpm setup` (`node scripts/setup.mjs`) is the interactive alternative to the
Phase 0–1 host-pnpm path for humans: it runs the same preflight checks and the
Phase 1 env bootstrap, then offers dependency installation and database
migrations. Agents keep following the deterministic phases below; the
wizard's `--check` and `--yes` flags exist for non-interactive shells.

## Phase 0 — Preflight

Run `git --version`. Then check the runtime for the path you chose. Docker and
Podman paths need no host Node.js or Corepack; their Node 22 toolchain runs in
the supplied container. Only the host-pnpm path requires Node.js and Corepack
on the host.

```bash
git --version          # any recent version
```

For Docker, the engine must be running and `docker version` must show Client
and Server sections:

```bash
docker version
docker compose version # Compose v2 plugin
```

For Podman:

```bash
podman version
```

For host-pnpm only:

```bash
node --version         # v22.x or newer (package.json engines: >=22.0.0)
corepack --version     # ships with Node 22; install Corepack if missing
```

Check the ports the stack needs are free — `3000` (web) and, for host-side
Postgres only, `5432`:

```bash
# macOS / Linux
lsof -i :3000 -i :5432 || ss -tln | grep -E ':(3000|5432)'
# Windows (Git Bash)
netstat -ano | findstr ":3000 :5432"
```

Decision table:

| Toolchain found                        | Path                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker version` shows Client + Server | Phase 2 (Docker).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Only `podman version` works            | Phase 3 (Podman).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Neither container runtime              | Host-pnpm path: first confirm host Node.js/Corepack, then `corepack pnpm install` and `corepack pnpm --filter @supastack/web dev`. Postgres still needs to come from somewhere — a managed `DATABASE_URL` (e.g. a Supabase project created with `corepack pnpm supabase:provision`) or Postgres you install yourself. The in-memory dashboard demo needs no database at all. Phase 1 env bootstrap still runs first — it applies to every path. |
| Docker present, want production image  | Follow Phase 5's Postgres → migrate → web order. Do not start the `app` profile before migrations.                                                                                                                                                                                                                                                                                                                                              |

OS notes:

- **Windows:** Docker Desktop requires WSL 2 — check `wsl --status`; if WSL is
  missing, `wsl --install --no-distribution` then reboot. If PowerShell blocks
  `corepack.ps1`, use `corepack.cmd`. For the pnpm shim without elevation, run
  `corepack enable --install-directory "$env:LOCALAPPDATA\supastack\corepack-shims"`
  and prepend that directory to `PATH` (README "Optional checks" has the exact
  PowerShell block — Turbo resolves `pnpm` by name).
- **macOS / Linux:** run `corepack enable` once so `pnpm` resolves; if it
  reports a permission error, prefix every command with `corepack pnpm`
  instead of installing a global pnpm.
- **Fedora/RHEL:** podman on SELinux needs the `:z` bind-mount suffix — see
  Phase 3.
- pnpm is pinned to `11.19.0` by `packageManager` in `package.json`. If the
  ambient `pnpm` resolves to another version, always invoke `corepack pnpm`;
  set `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` if corepack's download prompt
  blocks non-interactive shells.

## Phase 1 — Configure

The repo uses two env files (README): the web server reads
`apps/web/.env.local`; migration commands and `pnpm jobs:tick` read the root
`.env`. Run the helper from the repository root. It creates missing files
from `.env.example`, preserves existing values, generates only missing,
empty, or `replace-with-*` required secrets, and synchronizes the same valid
secret into both files. Existing mismatched or invalid secrets stop the
operation before either file is changed. A valid `CREDENTIAL_ENCRYPTION_KEY`
is preserved because rotating it can make stored credentials unreadable.

```bash
# With Node 22+ installed on the host:
node scripts/setup-env.mjs

# Docker-only host (macOS/Linux/WSL Bash):
docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim node scripts/setup-env.mjs

# Podman-only host:
podman run --rm -v "$PWD:/app" -w /app node:22-bookworm-slim node scripts/setup-env.mjs
```

```powershell
# Windows PowerShell with Node 22+:
node scripts/setup-env.mjs

# Docker Desktop-only host:
docker run --rm -v "${PWD}:/app" -w /app node:22-bookworm-slim node scripts/setup-env.mjs

# Podman Desktop-only host:
podman run --rm -v "${PWD}:/app" -w /app node:22-bookworm-slim node scripts/setup-env.mjs
```

On Windows, use the PowerShell form or run the Bash form inside WSL; Git Bash
rewrites container paths such as `/app` unless path conversion is disabled.

The helper prints only safe status and key/path names on failure. Do not print
env-file contents or copy secret values into commands, shell history, progress
output, or reports. It generates 32 random bytes for each required secret;
this corresponds to 64 hex characters for `AUTH_SECRET` and
`SCHEDULER_TICK_SECRET`, and Base64 of exactly 32 bytes for
`CREDENTIAL_ENCRYPTION_KEY`.

New files use mode `600` on POSIX. Restrict existing POSIX env files to the
owner as well. Windows applies inherited filesystem ACLs rather than POSIX
mode bits; keep the checkout in an account-private folder and ensure other
accounts cannot read its env files.

The helper validates `AUTH_SECRET` and `SCHEDULER_TICK_SECRET` as at least 32
characters (it generates 64-character hex strings), and validates
`CREDENTIAL_ENCRYPTION_KEY` as canonical Base64 encoding of exactly 32 bytes
(44 characters ending in `=`). In production, an unset scheduler secret makes
the tick endpoint return 404.

Minimum local configuration — defaults work, secrets come from step above:

| Variable                    | Local value                                               | Notes                                                                                            |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `APP_ENV`                   | `local`                                                   | default                                                                                          |
| `APP_URL`                   | `http://localhost:3000`                                   | drives auth trusted origins                                                                      |
| `DATABASE_URL`              | `postgres://supastack:supastack@localhost:5432/supastack` | matches compose credentials; inside containers the compose `environment:` overrides the hostname |
| `AUTH_SECRET`               | generated hex-64                                          | required for local auth                                                                          |
| `CREDENTIAL_ENCRYPTION_KEY` | generated base64-32B                                      | keep stable or encrypted credentials cannot be read                                              |
| `SCHEDULER_TICK_SECRET`     | generated hex-64                                          | enables `pnpm jobs:tick` and the tick endpoint                                                   |
| All `*_PROVIDER` selectors  | `local`/`fake`/`memory` defaults                          | app boots fully credential-free                                                                  |

Checkpoint: run the helper's read-only check. It validates required key
formats and confirms the managed secret values match across both files; its
output contains only a safe status or key/path names, never values.

```bash
node scripts/setup-env.mjs --check
# Or use the same Docker/Podman command above and append --check.
```

```powershell
# Windows PowerShell with Node 22+:
node scripts/setup-env.mjs --check

# Or append --check to the Docker Desktop command above.
```

Provider keys ship empty on purpose and are not flagged.

## Phase 2 — Local setup inside Docker

Everything runs in containers; only Docker and the repo are needed on the
host. `.env` and `apps/web/.env.local` from Phase 1 are bind-mounted in.

1. Start Postgres first. The migration and dev services both install packages
   into the bind-mounted checkout, so do not start them at the same time:

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres
   ```

2. Apply migrations before starting the dev server:

   ```bash
   docker compose -f docker-compose.dev.yml --profile migrate run --rm -T migrate
   ```

   (`-T` disables TTY allocation — required for non-interactive shells.)
   Expected: drizzle-kit logs the applied migrations and exits 0. Re-running
   is safe — already-applied migrations are skipped.

3. Start the dev server only after migration installation has finished:

   ```bash
   docker compose -f docker-compose.dev.yml up -d dev
   ```

4. Wait up to 10 minutes for the first install and Next.js boot. The poll is
   bounded to 198 attempts, each with a 2-second request limit and a 1-second
   pause. It reports progress every 10 retries and prints only the final
   health response or a short log tail on failure; it does not follow logs
   forever:

   ```bash
   for i in $(seq 1 198); do
     if curl --connect-timeout 2 --max-time 2 -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
       echo 'PASS: web health endpoint is ready'
       break
     fi
     if [ "$((i % 10))" -eq 0 ]; then printf 'Still waiting for web startup (%s/198)\n' "$i"; fi
     sleep 1
   done
   if ! curl --connect-timeout 2 --max-time 5 -fsS http://localhost:3000/api/health; then
     echo 'FAIL: web health endpoint did not become ready; recent dev logs follow' >&2
     docker compose -f docker-compose.dev.yml ps
     docker compose -f docker-compose.dev.yml logs --tail=100 dev
     exit 1
   fi
   ```

   Expected: JSON containing `"status":"ok"` (the endpoint returns 503 while
   Postgres is unreachable). The non-following log command returns immediately.

5. Demo checkpoint — open `http://localhost:3000/ai`, keep the
   prefilled name/email, click **Start local reference flow**, open **AI
   task**, click **Queue local task**, then **Run local task** and **View
   result**. A completed result confirms the fake AI demo flow only; it does
   not prove sign-in, saved user data, or workspace authorization. Verify
   those separately using the acceptance checklist below. Mail lands in
   `/mail-preview` under `EMAIL_PROVIDER=local`.

Notes:

- Inside the container the app uses `DATABASE_URL=postgres://…@postgres:5432`
  — the compose `environment:` wins over the mounted `.env`/`.env.local`
  because Next.js and `process.loadEnvFile` never override variables that are
  already set. Do not "fix" this by editing `.env` to the container hostname —
  the host copy would break.
- File edits on the host propagate into the bind mount. If hot reload stops
  firing (Docker Desktop on macOS/Windows), uncomment `WATCHPACK_POLLING` in
  `docker-compose.dev.yml`.
- Host-hybrid alternative: keep the app on the host and only containerize
  Postgres — `docker compose up -d postgres` (the base compose file publishes
  5432), `corepack pnpm install`, `corepack pnpm --filter @supastack/web dev`,
  `corepack pnpm --filter @supastack/db db:migrate`. Do not mix host and
  container `pnpm install` runs on the same checkout without reinstalling —
  platform binaries differ.

## Phase 3 — Local setup inside Podman

Podman runs the same `docker-compose.dev.yml` through a compose provider.

1. Enable the Podman socket and pick a provider:

   ```bash
   systemctl --user enable --now podman.socket
   export DOCKER_HOST=unix:///run/user/$UID/podman/podman.sock
   ```

   Prefer the `docker-compose` binary pointed at the socket via
   `DOCKER_HOST` — it fully implements `depends_on.condition:
service_healthy`, which the dev stack relies on. `podman-compose`
   (`pip install podman-compose`, then `podman compose` / `podman-compose`)
   only honors that condition from ≥1.1.x — older releases ignore it, so
   `dev`/`migrate` can start before postgres is ready and race it.

   On macOS/Windows there is no systemd user socket — `podman machine init`
   then `podman machine start`; `podman compose` forwards into the machine.
   The `.:/app` bind mount only reaches host paths the machine VM shares
   (default: the user directory) — keep the checkout under it or extend the
   machine's shared paths; on Windows, running the docker-compose provider
   inside WSL sidesteps this.

2. SELinux (Fedora/RHEL): if `getenforce` prints `Enforcing`, append `:z` to
   the source bind mounts in `docker-compose.dev.yml` — `- .:/app:z` — or
   the container cannot read the repo.

3. Start Postgres, migrate, then start the dev server. Keep these steps
   sequential because the one-shot migration and dev services install into
   the same bind-mounted checkout:

   ```bash
   podman compose -f docker-compose.dev.yml up -d postgres
   podman compose -f docker-compose.dev.yml --profile migrate run --rm -T migrate
   podman compose -f docker-compose.dev.yml up -d dev
   ```

4. Wait up to 10 minutes for first install and Next.js boot. The poll is
   bounded to 198 attempts, each with a 2-second request limit and a 1-second
   pause. It reports progress every 10 retries and prints only the final
   health response or a short log tail on failure:

   ```bash
   for i in $(seq 1 198); do
     if curl --connect-timeout 2 --max-time 2 -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
       echo 'PASS: web health endpoint is ready'
       break
     fi
     if [ "$((i % 10))" -eq 0 ]; then printf 'Still waiting for web startup (%s/198)\n' "$i"; fi
     sleep 1
   done
   if ! curl --connect-timeout 2 --max-time 5 -fsS http://localhost:3000/api/health; then
     echo 'FAIL: web health endpoint did not become ready; recent dev logs follow' >&2
     podman compose -f docker-compose.dev.yml ps
     podman compose -f docker-compose.dev.yml logs --tail=100 dev
     exit 1
   fi
   ```

   Expected: JSON containing `"status":"ok"` (the endpoint returns 503 while
   Postgres is unreachable), then the Phase 2 demo checkpoint. Rootless Podman
   needs no special handling — only high port 3000 is published; Postgres stays
   internal to the pod network. Sanitize any diagnostics before reporting them.

## Deploying — the universal sequence

Every deploy path below follows the same skeleton: provision the host → set
env vars → deploy the image → run migrations → configure webhooks and the
scheduler tick → verify. Phases 4 and 5 differ only in who operates the
machinery — Coolify manages it for you; on a plain VPS you do.

## Phase 4 — Deploy to a VPS with Coolify

Condensed checklist — the full walkthrough with sizing and screenshots-level
detail lives in `docs/vps-coolify.md`; read it before improvising. Apply the
security and acceptance rules in `docs/agent-security.md` to either deploy path.

1. Provision an Ubuntu LTS or Debian VPS (~4 GB RAM if building on the box;
   ~1–2 GB if deploying a CI-built image). Open `22`, `80`, `443`, and —
   temporarily — `8000`, `6001`, `6002`.
2. Install Coolify as root:

   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

3. Open `http://<server-ip>:8000`, create the admin account and a
   project + `production` environment.
4. Postgres: add a Coolify Postgres service (copy its internal connection
   string — app and DB share the Docker network) or use managed Postgres. Use
   unique production credentials; the `supastack:supastack` values are local
   Compose examples only. Keep the database port private.
5. Application resource: repo source → build pack **Dockerfile** (not
   Nixpacks), Dockerfile `/Dockerfile`, base directory `/`, port **8080**,
   healthcheck path **`/api/health`**.
6. Set environment variables in Coolify's UI before deploying — never mark
   secrets as Build Variables. The first seven are **boot-required** under
   `APP_ENV=production` — `packages/config` rejects startup without them:

   | Variable                    | Value                                                                              |
   | --------------------------- | ---------------------------------------------------------------------------------- |
   | `APP_URL`                   | exact public `https://` origin — no path, no localhost                             |
   | `DATABASE_URL`              | Postgres connection string                                                         |
   | `AUTH_SECRET`               | Unique random secret, at least 32 characters; enter through Coolify's secret field |
   | `CREDENTIAL_ENCRYPTION_KEY` | Base64 encoding of exactly 32 random bytes; keep stable across upgrades            |
   | `EXPO_PUBLIC_API_URL`       | same `https://` origin for web-only deploys                                        |
   | `EXPO_PUBLIC_APP_SCHEME`    | any valid scheme, e.g. `supastack`                                                 |
   | `MOBILE_ALLOWED_ORIGINS`    | comma-separated `https://` origins — the app origin is enough without a mobile app |

   Not boot-enforced, but required for the features this deploy uses:

   | Variable                | Value                                                                |
   | ----------------------- | -------------------------------------------------------------------- |
   | `SCHEDULER_TICK_SECRET` | Unique random secret, at least 32 characters — enables the tick task |
   | `RATE_LIMIT_STORE`      | `postgres` (also the automatic default under `NODE_ENV=production`)  |
   | `TRUSTED_PROXY_COUNT`   | `1` — Coolify's Traefik is one controlled proxy                      |
   | `ADMIN_EMAILS`          | comma-separated bootstrap admin emails                               |

   Generate production secrets in a password manager or secret manager and
   enter them directly into Coolify's runtime-only secret fields. Keep them
   separate from local `.env` secrets; do not run a generator that prints
   secret values into an agent log or shell transcript.

7. Migrations: before the first deploy and every upgrade, follow the
   [Coolify in-network migrator procedure](vps-coolify.md#migrations). It runs
   a throwaway Node 22 container on the private database's shared network and
   does not require host Node.js or exposing Postgres port `5432`. Do not
   migrate from a local checkout when its internal database URL is unreachable;
   inject only the production URL through the protected env file described in
   that procedure.

8. Scheduler tick (with `JOB_PROVIDER=local`): Coolify Scheduled Task on the
   application, frequency `* * * * *`, command (runs via `sh` inside the app
   container, `node` is present):

   ```bash
   node -e "fetch('http://127.0.0.1:8080/api/internal/scheduler-tick',{method:'POST',headers:{'x-scheduler-key':process.env.SCHEDULER_TICK_SECRET}}).then(r=>process.exit(r.ok?0:1))"
   ```

9. Domain: set it in Coolify; its proxy issues Let's Encrypt certificates —
   keep port 80 reachable. `APP_URL` must equal the final URL exactly.

Verification: run the [Verification checklist](#verification-checklist)
against `https://<your-domain>`.

## Phase 5 — Deploy to a plain VPS inside Docker

No Coolify — you own Docker, TLS, and the tick timer.

1. Provision Ubuntu LTS or Debian; SSH in. Install Docker from the official
   apt repo (Ubuntu shown — for Debian use `download.docker.com/linux/debian`
   and the Debian codename):

   ```bash
   sudo apt-get update
   sudo apt-get install -y ca-certificates curl git
   sudo install -m 0755 -d /etc/apt/keyrings
   sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
   sudo chmod a+r /etc/apt/keyrings/docker.asc
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt-get update
   sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

2. Clone a fresh repository checkout on the VPS; do not copy local `.env`
   files. Create production-only app secrets with the helper, which writes
   missing env files with mode `600` and never prints values. If Node 22 is
   not installed, run it in the Docker container:

   ```bash
   docker run --rm -v "$PWD":/app -w /app node:22-bookworm-slim node scripts/setup-env.mjs
   ```

   Generate a unique 32-byte hex Postgres password in a password manager or
   secret manager. With a protected editor or secret injection, set
   `APP_ENV=production`, the public URLs, and the same DB password in
   `POSTGRES_PASSWORD` and `DATABASE_URL` (using the Compose hostname
   `postgres`). Do not use the local `supastack` example on a VPS. Keep secret
   values out of command history and reports. Restrict `.env` to the account
   that runs Compose (`chmod 600 .env`).

   ```env
   APP_ENV=production
   APP_URL=https://yourdomain.com
   DATABASE_URL=postgres://supastack:<same-generated-hex-password>@postgres:5432/supastack
   POSTGRES_PASSWORD=<same-generated-hex-password>
   EXPO_PUBLIC_API_URL=https://yourdomain.com
   EXPO_PUBLIC_APP_SCHEME=supastack
   MOBILE_ALLOWED_ORIGINS=https://yourdomain.com
   RATE_LIMIT_STORE=postgres
   TRUSTED_PROXY_COUNT=1
   ADMIN_EMAILS=you@yourdomain.com
   ```

   These are deployment-specific values, not a command. Replace the
   angle-bracket DB password with one generated by your secret manager. The
   `setup-env.mjs` helper already created `AUTH_SECRET`,
   `CREDENTIAL_ENCRYPTION_KEY`, and `SCHEDULER_TICK_SECRET`; preserve those
   production-checkout values. If enabling the optional `storage` profile,
   also set unique `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` values. The
   Compose ports for Postgres, the app upstream, and MinIO bind to
   `127.0.0.1` by default, so Caddy can reach the app on `127.0.0.1:3000` while
   those ports stay unavailable from other machines. Do not change them to
   `0.0.0.0` for this topology.

   `POSTGRES_PASSWORD` initializes the role only when `postgres-data` is empty.
   Changing it in `.env` does not change an existing database password; use a
   planned `ALTER ROLE` and update the connection string. Never delete the
   volume to make a credential change take effect.

   The production image forces `APP_ENV=production` at startup regardless of
   the env file (Dockerfile `ENV` + `CMD`), and the config refuses to boot
   without the variables above.

3. Start Postgres only. Its published port is loopback-bound before any app
   service starts:

   ```bash
   docker compose up -d postgres
   ```

   Confirm `docker compose ps postgres` reports the database healthy before
   running migrations. The base compose file also binds web and optional
   MinIO ports to loopback by default.

4. Apply migrations before starting the app or allowing a sign-in. The production image ships
   only `.next/standalone` (no drizzle-kit inside) and a fresh VPS has no
   Node — run the migrate in a throwaway `node:22-bookworm-slim` container
   with the checkout mounted. `--network host` reaches Postgres through its
   published port on `localhost` (a Linux-only flag — fine on a VPS, and it
   still works if you bound the port to loopback per step 3's note):

   ```bash
   umask 077
   migration_env=$(mktemp)
   trap 'rm -f "$migration_env"' EXIT
   sed -n 's/^DATABASE_URL=//p' .env | sed 's/@postgres:5432/@localhost:5432/' | sed 's/^/DATABASE_URL=/' > "$migration_env"
   if [ ! -s "$migration_env" ]; then echo 'DATABASE_URL is missing from .env' >&2; exit 1; fi
   docker run --rm --network host --env-file "$migration_env" -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
     -v "$PWD":/app -v supastack-pnpm-store:/root/.local/share/pnpm/store \
     -w /app node:22-bookworm-slim sh -c \
     'corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @supastack/db db:migrate'
   ```

   The mode-600 temporary env file contains only `DATABASE_URL`; the command
   changes the Compose hostname to the loopback-published Postgres port without
   putting the password in shell history, then deletes the file on exit. The
   dev-file `migrate` profile is not used here because its Postgres service
   definition differs and Compose could recreate the running production
   container. Rerun the same command after upgrades that add migrations in
   `packages/db/drizzle/`; already-applied migrations are skipped.

5. Start the app after migrations succeed. The `app` profile builds the
   Dockerfile image (Next.js standalone, port 8080 internally) and maps
   `127.0.0.1:3000` to `8080`; Postgres is already running and healthy:

   ```bash
   docker compose --profile app up -d web
   ```

   The web service has no restart policy; choose one deliberately if the
   operator needs automatic restarts. Compose publishes only on loopback, so
   Docker's firewall rules cannot expose Postgres, the app upstream, or MinIO
   to the internet. Host-side migrations reach Postgres at localhost.

6. TLS with Caddy (official repo):

   ```bash
   sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt-get update && sudo apt-get install -y caddy
   ```

   `/etc/caddy/Caddyfile`:

   ```caddyfile
   yourdomain.com {
       reverse_proxy 127.0.0.1:3000
   }
   ```

   `sudo systemctl enable --now caddy && sudo systemctl reload caddy`.
   `APP_URL` must equal the final `https://` origin — it drives auth trusted
   origins and canonical URLs. `TRUSTED_PROXY_COUNT=1` is correct here:
   Caddy is the single controlled proxy appending `x-forwarded-for`.

7. Firewall — allow only SSH/HTTP/HTTPS:

   ```bash
   sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
   sudo ufw --force enable
   ```

8. Scheduler tick via cron — copy only the key from `.env` into a mode-600
   root file, then POST every minute with the `x-scheduler-key` header. Keep
   the key out of command text and reports. Preserve an existing file:

   ```bash
   if sudo test -e /etc/supastack-tick.env; then
     echo 'Existing tick env file found; verify root ownership and mode 600 without printing it, then keep it.'
   else
     umask 077
     tick_env=$(mktemp)
     trap 'rm -f "$tick_env"' EXIT
     grep -E '^SCHEDULER_TICK_SECRET=.+$' .env > "$tick_env"
     if [ ! -s "$tick_env" ]; then echo 'SCHEDULER_TICK_SECRET is missing or empty in .env' >&2; exit 1; fi
     sudo install -o root -g root -m 600 "$tick_env" /etc/supastack-tick.env
   fi
   (sudo crontab -l 2>/dev/null | grep -vF '# supastack scheduler tick' || true; echo '* * * * * . /etc/supastack-tick.env && curl -fsS -X POST -H "x-scheduler-key: $SCHEDULER_TICK_SECRET" http://localhost:3000/api/internal/scheduler-tick # supastack scheduler tick') | sudo crontab -
   ```

   In production, the alternative is `JOB_PROVIDER=trigger` +
   `TRIGGER_SECRET_KEY`/`TRIGGER_PROJECT_REF` — Trigger.dev Cloud runs the
   `scheduler.tick` cron and no VPS-side tick is needed.

9. Verification: run the checklist below against `https://yourdomain.com`,
   and confirm `docker compose logs web` shows a clean start (a missing
   production env var exits the container at boot — check logs first).

## Security protocols — non-negotiable

Follow [`docs/agent-security.md`](agent-security.md) for the full database,
authentication, logging, recovery, and acceptance checklist. It separates
health/demo evidence from real sign-in and workspace authorization evidence.

1. **Generated secrets only.** The local `setup-env.mjs` helper generates
   only missing local keys and never prints their values. Generate separate
   production values in a password manager or secret manager and enter them
   directly into protected runtime configuration. `replace-with-*`
   placeholders must never reach a production deploy — `packages/config`
   rejects a bad-shaped `CREDENTIAL_ENCRYPTION_KEY` and a short `AUTH_SECRET`
   when `APP_ENV=production`.
2. **Secrets stay server-only.** Never prefix a secret with `NEXT_PUBLIC_` or
   `EXPO_PUBLIC_` — those ship to client bundles. `NEXT_PUBLIC_*` is for the
   Turnstile site key and PostHog only. Keep provider keys out of logs; the
   observability layer redacts, but don't rely on it.
3. **`.env*` is never committed.** `.gitignore` covers `.env`, `.env.*`, and
   `*.local`; only `*.example` templates ship. Restrict production `.env`
   permissions, never print values while checking it, and rotate a secret if
   it ever lands in a commit.
4. **`APP_ENV=production` needs the full production set** — `APP_URL`,
   `DATABASE_URL`, `AUTH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`,
   `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_SCHEME`, `MOBILE_ALLOWED_ORIGINS` —
   and the production image forces `APP_ENV=production` at start, so an
   `APP_ENV=local` env file cannot downgrade it.
5. **Workspace isolation is structural.** Every user-owned record carries
   `workspaceId`; injected `ToolContext` means a model can never pick a
   workspace. Preserve scoping in every query and feature you write.
6. **Postgres RLS on Supabase:** run `corepack pnpm supabase:doctor` after
   provisioning — it audits SSL, pooler mode, pending migrations, and
   public-schema tables PostgREST could expose (RLS disabled or
   anon/authenticated grants), printing exact fix SQL. `--fix-rls` applies
   `ENABLE ROW LEVEL SECURITY` + `REVOKE ... FROM anon, authenticated` in one
   transaction.
7. **Rate limiting stays on.** `RATE_LIMIT_STORE=postgres` in production
   (automatic under `NODE_ENV=production` — set it anyway). Set
   `TRUSTED_PROXY_COUNT` to the real number of controlled proxies (Caddy or a
   single PaaS proxy = `1`; direct exposure = `0`).
8. **Transactional and outreach email stay separate.** `EmailSender.send`
   only accepts `category: "transactional"` — adapters throw on outreach;
   there is no campaign capability. Don't add one to the transactional path.
9. **Launch gates:** `EARLY_ACCESS_INVITE_ONLY=true` gates sign-up behind
   invite codes (`/admin/waitlist`); `ADMIN_EMAILS` bootstraps the platform
   admin role on signup.
10. **Public AI stays budgeted.** `PUBLIC_AI_DAILY_BUDGET_MICROUNITS`
    defaults to `0` — public AI endpoints are disabled and reservations throw
    `PublicAiBudgetExceededError` before any provider call. Raise it only
    deliberately.
11. **Don't bypass the audit trail.** Audit events, webhook deliveries, and
    job runs are recorded in Postgres (`audit_event`, `webhook_event`,
    `webhook_delivery`, `task_run`, `job_schedule`) — they are how you
    reconstruct incidents.

## Verification checklist

Use this as a status checklist after the selected path, then complete
`docs/agent-security.md`. Keep **demo/health checks** separate from **real
authentication and isolation evidence**. Do not claim sign-in, migration
readiness, or workspace isolation from the local reference demo. Health runs
anywhere; run Node-dependent checks only through a toolchain available on the
selected machine.

```bash
BASE=http://localhost:3000   # or https://yourdomain.com

# 1. Health — expect HTTP 200 and "status":"ok" (503 while Postgres is down)
curl -fsS "$BASE/api/health"
```

The tick command reads `SCHEDULER_TICK_SECRET` from the process environment or
root `.env`; the URL override does not expose the key. For a remote Coolify
deploy where the key is not available to the checkout, use the Coolify task's
**Execute Now** result instead of copying the key into a command or report.

Migration status: on a Node-equipped checkout, run
`corepack pnpm --filter @supastack/db db:migrate`; it exits 0 and applies
nothing when caught up. On a Node-less plain VPS, rerun the Phase 5 one-shot
migration command. Scheduler status: where Node/Corepack and the root `.env`
are available, run `SCHEDULER_TICK_URL="$BASE" corepack pnpm jobs:tick`. On a
Node-less plain VPS, run the script from the checkout in a Node container:

```bash
docker run --rm --network host -e SCHEDULER_TICK_URL="$BASE" \
  -v "$PWD":/app -w /app node:22-bookworm-slim node scripts/scheduler-tick.mjs
```

The credential-free local gate is `corepack pnpm check:local` from a
Node-equipped checkout. Mark it `NOT RUN` when that toolchain is unavailable;
do not install host Node just to run a check for the container-only path.

Record local demo and health output under `demo/health`. For real auth and
isolation, use two unrelated fictional users and follow the cross-user checks
in `docs/agent-security.md`; report `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` with
safe evidence. One user switching between workspaces is not proof of
cross-user isolation. Sign-up at `/auth`, persisted session data, and a denied
cross-user read/write are separate checks.
Webhook receivers for billing providers (from `docs/deployment.md`):
`/api/billing/webhook` (Stripe), `/api/billing/webhook/lemonsqueezy`
(`x-signature`), `/api/billing/webhook/creem` (`creem-signature`),
`/api/billing/webhook/paddle` (`Paddle-Signature`), Standard Webhooks headers
for `/api/billing/webhook/polar|whop|dodo`, `PayPal-*` transmission headers
for `/api/billing/webhook/paypal`, and `/api/billing/webhook/revenuecat`.

## Troubleshooting

| Symptom                                              | Cause                                                                                  | Fix                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `port 3000 already allocated` / address in use       | Another dev server or stack is running                                                 | `docker compose -f docker-compose.dev.yml down`, stop the other server, or edit the published port       |
| Port 5432 in use on the host                         | A host Postgres or `docker-compose.yml` postgres is bound                              | Use the dev file (its postgres is internal-only), or stop the other Postgres                             |
| `env file .env not found`                            | Phase 1 copy step skipped                                                              | `cp .env.example .env` (and `apps/web/.env.local`)                                                       |
| `the input device is not a TTY`                      | `compose run` allocated a pseudo-TTY in a non-interactive shell                        | The documented commands already pass `-T`; keep it for any `run`/`exec` you add                          |
| `pnpm` resolves to a version that is not 11.19.0     | Ambient pnpm shadows the corepack pin                                                  | Always run `corepack pnpm`; on Windows use the `--install-directory` shim from the README                |
| Corepack stalls on a download prompt                 | Non-interactive shell                                                                  | `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` (already set in the dev container)                                   |
| Migrations fail to connect inside a container        | `DATABASE_URL` points at `localhost` — inside a container that is the container itself | Use the `postgres` service hostname; the dev file's `environment:` already does                          |
| `/api/health` 503                                    | Database check failed                                                                  | `docker compose -f docker-compose.dev.yml ps` — postgres must be `healthy`; `logs dev` shows boot errors |
| `/api/health` connection refused                     | Dev server not up yet or crashed                                                       | `docker compose -f docker-compose.dev.yml logs dev`                                                      |
| Host `pnpm dev` can't reach Postgres                 | Dev-file postgres publishes no host port                                               | Use `docker compose up -d postgres` (base file) for host-side dev                                        |
| File edits don't hot-reload in the container         | Bind-mount events don't propagate (Docker Desktop)                                     | Uncomment `WATCHPACK_POLLING: "true"` in `docker-compose.dev.yml`                                        |
| Native module / esbuild errors after switching sides | Host and container `node_modules` got mixed                                            | Delete `node_modules` (root + `apps/*` + `packages/*`) and reinstall on one side only                    |
| `scheduler-tick` returns 404                         | `SCHEDULER_TICK_SECRET` unset in the app's env                                         | Set it in `.env`/Coolify env and restart                                                                 |
| `scheduler-tick` returns 401                         | Wrong `x-scheduler-key`                                                                | The header value must equal `SCHEDULER_TICK_SECRET` exactly                                              |
| Production container exits at boot                   | Missing prod-required env                                                              | `docker compose logs web` — `packages/config` names the missing variable                                 |
| Docker Desktop won't start on Windows                | WSL 2 missing                                                                          | `wsl --status`; `wsl --install --no-distribution`, reboot                                                |
