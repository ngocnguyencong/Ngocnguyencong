# setup-content.test.ts

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

Verify the separate setup app exposes executable local setup instructions,
keeps real-provider credentials and smoke checks opt-in, and points agents at
the autonomous setup runbook.

## What It Does

- First test pins `local` (title, `requiresCredentials: false`, steps
  mentioning `apps/web/.env.local`, `corepack pnpm install`, the filtered web
  dev command, the `/ai` URL) and `providers` (`requiresCredentials`,
  `pnpm smoke:providers`, the four prerequisites).
- Second test pins `agent` — title "AI agent setup path", credential-free,
  `runbook` = `docs/agent-setup.md`, and steps mentioning `llms.txt`,
  `AGENTS.md`, `docs/agent-setup.md`, `.env.example`,
  `docker-compose.dev.yml`, `docs/vps-coolify.md`, `jobs:tick`,
  `/api/health`.

## Important Notes

- Extend by appending assertions/tests; the pinned `local`/`providers`
  expectations must not be rewritten.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Pinned local-setup URL updated to `http://localhost:3000/ai` | Devin |
| 2026-10-06 | Added `agent` block assertions (title, requiresCredentials, runbook, llms.txt/runbook mentions) | Devin |
