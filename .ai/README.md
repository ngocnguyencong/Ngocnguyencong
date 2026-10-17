# README.md (repo root)

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Short entry doc: what supastack is, the `Your first local Web run`
quickstart (copy `.env.example` to root `.env` **and**
`apps/web/.env.local` → `corepack pnpm install` →
`corepack pnpm --filter @supastack/web dev` → browser demo), then
`Optional checks and all-workspace development` (`check:local`,
`verify:local`, all-workspace `corepack pnpm dev`, Docker Postgres +
`db:migrate`), and pointers into `docs/` for the opt-in real-provider and
Trigger.dev paths.

## Important Notes

- The opening paragraph sets Expo starter scope and links selective-adoption
  and upgrade guides. Windows notes give bounded Defender first-run guidance:
  let installation finish, rerun the failed browser command, then inspect any
  repeat failure without disabling system-wide protection. The local E2E
  runner owns port 3100 and documents `PLAYWRIGHT_PORT` for collisions.
- A short paragraph after the tutorial links states what the desktop shell
  includes today (window management, system tray, global summon hotkey,
  single-instance, `supastack://` deep links, native menus, and a branded
  unreachable-app fallback) and that code signing/notarization, auto-updates,
  and launch-at-login stay with the buyer's release pipeline; it names the
  `check:release-config` preflight command.
- A one-line pointer after the intro paragraphs directs AI coding agents to
  `llms.txt` first (the agent map: docs, prompts, security protocols) and now
  also names `AGENTS.md` for boundaries + `prompts/agent-setup.md` as the
  paste-first prompt — keep it as the only agent-facing line; the file stays
  buyer/maintainer-facing.
- Keep it terse — deep docs live in `docs/`; AGENTS.md holds agent rules.
- 2026-10-02 planned revision: replace compressed first-run commands with prerequisite links, editor/terminal location, separate Windows/macOS env-copy commands, a Web-only launch and the actual `/ai` demonstration. Preserve optional validation, native/backend boundaries and platform-specific troubleshooting.
- `### Windows notes` covers LF pinning (`.gitattributes`) + `core.longpaths`
  for the turbo link-name warning, plus Docker Desktop/WSL 2 prereqs
  (`wsl --status`, `docker version`, `docker compose version`,
  `wsl --install --no-distribution`). Extend here for platform-specific setup.
- A guided-option paragraph follows the toolchain check in the quickstart:
  `corepack pnpm setup` (`node scripts/setup.mjs`) runs the interactive
  wizard — preflight, env bootstrap with generated secrets, optional
  install/migrations — while the manual OS-split blocks stay for readers who
  want each command spelled out.
- The quickstart/`Optional checks` sections document Corepack's non-elevated
  `enable --install-directory` bootstrap into `%LOCALAPPDATA%`, with that shim
  directory prepended to the PowerShell session `PATH` because Turbo resolves
  `pnpm` itself. `check:local`/`verify:local` are the non-desktop gates (no
  Rust) vs `check` (full CI, cargo) vs `verify:desktop` (Tauri); web/docs
  ports 3000/3001, and the optional Docker Postgres + `db:migrate` path.
- Windows builds use the portable launcher and default to read-only Turbo cache.
  The original issue was reproduced again with all 18 tasks successful and the
  root process stalled after its summary. Explicit cache policies still win.
  E2E scripts install pinned Chromium, and the complete local gate resets the
  Web cache between its two browser suites. Next typechecking generates ignored
  environment/route types on a cold checkout.
- The original Windows investigation found a bounded Turbo cache workaround. In an
  isolated checkout, Web build completed but Turbo waited after its success
  summary with writable caches (shared and local); setting
  `TURBO_CACHE=local:r,remote:r` let the full non-desktop build exit 0.
  The note applies only to that symptom and states that it skips new cache writes.
- The trailing `## License` section points buyers at `LICENSE.md` and
  summarizes it in two sentences (unlimited end products, no codebase
  redistribution, per-developer seats) — keep it aligned with
  `licenseAgreement` in `apps/web/src/marketing/legal-content.ts`.
- README is English-only (Chinese mirror removed 2026-09-22 for the US
  buyer audience — see PROJECT_CONTEXT).

## Agent Decisions / Thoughts

- **2026-09-28 Codex:** The quickstart includes a Corepack-generated shim
  because Turbo's workspace runner cannot work with `corepack pnpm` alone. A
  user-writable install directory avoids `Program Files` elevation and keeps
  the project on its pinned pnpm version.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | Quickstart gains the guided `corepack pnpm setup` paragraph; manual env-copy/install blocks kept | Devin |
| 2026-10-08 | Agent pointer names `AGENTS.md` + `prompts/agent-setup.md` so the chain resolves in one hop | Devin |
| 2026-10-06 | One-line `llms.txt` pointer for AI coding agents after the intro | Devin |
| 2026-10-03 | `## License` section — points at LICENSE.md, summarizes grant/seats | Devin |
| 2026-10-02 | Noted what the desktop shell ships vs the release-pipeline concerns it leaves to the buyer | Devin |
| 2026-09-28 | Added a Windows read-only Turbo cache workaround for a build that hangs after its success summary | Codex |
| 2026-09-28 | Documented non-elevated Corepack shim bootstrap and aligned local commands | Codex |
| 2026-09-27 | Set Expo scope up front; linked adoption/upgrade guides; added Windows first-run browser note | Codex |
| 2026-09-27 | `.ai/` published — removed from `.gitignore` so the mirror docs ship in the repo | Devin |
| 2026-09-20 | Added Windows notes (EOL + longpaths) for issue #1 | Devin |
| 2026-09-21 | Bilingual README: `English | Simplified Chinese` toggle + `## Chinese` mirror of every section | Devin |
| 2026-09-22 | Reverted to English-only (dropped toggle + `## Chinese` mirror) | Devin |
| 2026-09-22 | Local-workflow/Windows notes: corepack/elevation, verify gates, ports, Docker/WSL 2 | Devin |
