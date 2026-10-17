# setup-content.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

English setup content for the separate monorepo documentation app at port
3001. Exports `setupGuidance` with three blocks rendered as ordered sections
on `apps/docs/app/page.tsx`.

## What It Does

- `local` — credential-free fake-adapter quickstart steps (clone → env copies
  → `corepack pnpm install` → filtered web dev → `/ai` AI-task demo).
- `agent` — the autonomous-agent path in five steps: read `llms.txt` +
  `AGENTS.md`, execute `docs/agent-setup.md`, bootstrap env from
  `.env.example` with generated secrets, pick containerized
  (`docker-compose.dev.yml`/`podman`) or host local setup, pick a deploy
  target (Coolify per `docs/vps-coolify.md` or VPS + compose `app` profile
  behind Caddy), verify via `/api/health`, sign-in isolation, and
  `pnpm jobs:tick`. `requiresCredentials: false`, `runbook` points at
  `docs/agent-setup.md`.
- `providers` — credential-gated real-provider smoke prerequisites +
  `pnpm smoke:providers` runbook pointer.

## Important Notes

- Keep local demonstration instructions separate from database-backed
  authentication and real-provider acceptance.
- Web reads apps/web/.env.local; root .env is for migration commands.
  Desktop/Mobile clients need their own running backend.
- The `agent` block's claims must stay in lockstep with `docs/agent-setup.md`
  and `docker-compose.dev.yml` (file names, commands, `/api/health`,
  `pnpm jobs:tick`, `x-scheduler-key`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Local quickstart demo URL → `http://localhost:3000/ai` (console moved off `/dashboard`) | Devin |
| 2026-10-06 | Added `agent` block (AI agent setup path) alongside untouched `local`/`providers` | Devin |
