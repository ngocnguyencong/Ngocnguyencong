# Prompt: agent setup and deploy

Stand up this supastack checkout end to end for **`<SETUP_PATH: docker |
podman | host>`** and deploy it to **`<DEPLOY_TARGET: coolify | vps-docker |
local-only>`**.

1. Read `llms.txt` at the repo root for the map, then `AGENTS.md` for the
   non-negotiable boundaries, read `docs/agent-security.md`, then execute
   `docs/agent-setup.md` in order and follow its verification checkpoints.
2. Bootstrap only from `.env.example` with `node scripts/setup-env.mjs` and
   verify with `node scripts/setup-env.mjs --check` (or the Node 22 Docker or
   Podman container commands in the runbook when the host has no Node.js).
   The helper creates only missing files, preserves existing valid config,
   generates only missing/empty/placeholder secrets, synchronizes matching
   values, and stops on invalid or conflicting keys before writing. Keep a
   valid `CREDENTIAL_ENCRYPTION_KEY` stable. Never invent env names or print
   secret values into commands, shell history, or reports.
3. Stand the app up per `<SETUP_PATH>`: Docker and Podman run the
   containerized dev stack in `docker-compose.dev.yml` and do not require
   host Node.js/Corepack; start Postgres, migrate, then start the app so the
   two installers do not race on the shared checkout. `host` requires Node
   22+ and runs `corepack pnpm dev` against the configured Postgres.
4. Deploy per `<DEPLOY_TARGET>`: `coolify` follows the checklist in
   `docs/vps-coolify.md` (Dockerfile build pack, port 8080, `/api/health`
   healthcheck, runtime-only env vars, scheduled task for the tick, and
   unique database credentials);
   `vps-docker` follows Phase 5 in order: start Postgres, migrate, then start
   the `app` profile's web service behind Caddy for TLS. Set a unique Postgres
   password in both `POSTGRES_PASSWORD` and `DATABASE_URL` before the first
   start; published ports bind to loopback. Open `ufw` only on 22/80/443 and
   configure a cron or systemd timer for the scheduler tick. `local-only`
   stops at local verification. In
   production keep `RATE_LIMIT_STORE` and `TRUSTED_PROXY_COUNT` honest for the
   actual proxy topology.
5. Run migrations before the first real sign-in against the target database.
   Use the safe env handling in the runbook; never put the connection string in
   a command literal or report. An account created before migrations land is a
   broken account.
6. Report a status checklist with safe evidence, not claims: keep local
   `demo/health` output separate from real auth and workspace-isolation
   results. For real isolation use two unrelated fictional users, not one user
   switching workspaces. Mark each applicable security acceptance check
   `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` using `docs/agent-security.md`.
   Include health response, migration state, scheduler status, and local gate
   result — `corepack pnpm check:local` in the monorepo, `corepack pnpm check`
   in a standalone platform checkout. Never claim real sign-in or isolation
   from the dashboard demo.

Never commit `.env*` files. Never ship placeholder secrets to a production
deploy. Never prefix a server secret with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
Scope every user-owned record by `workspaceId`. If a step fails twice, stop
and report the command and sanitized output instead of working around it — and
never disable a security feature to silence an error: auth checks stay on,
Supabase deployments fix RLS exposure via `corepack pnpm supabase:doctor --fix-rls`,
and rate limits stay configured. Ask before anything destructive — dropping
volumes, replacing an existing secret, or wiping a database.
