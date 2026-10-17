# src/setup-readiness.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Pure readiness evaluator for the `/setup` checklist:
`evaluateSetupReadiness(snapshot)` maps a `SetupSnapshot` (reduced env/DB/
code facts) to a `SetupReport` — ordered `SetupCheck[]` across
`foundation | accounts | providers | product | platforms`, status counts,
and `readyForProduction`.

## Important Notes

- The snapshot carries booleans, kinds, lengths, and labels only —
  `setup-readiness-runtime.ts` reduces every secret before it reaches this
  module; the report can never contain a credential value.
- Statuses: `ready` (done), `action` (must fix), `demo` (fake/local/memory
  provider or dev default), `optional` (nice-to-have). Within a group,
  rows sort action → demo → optional → ready.
- `readyForProduction` = no `action` checks AND no `demo` checks in
  foundation/accounts or the `providers.email`/`providers.billing` rows —
  demo AI/storage don't block.
- Provider checks map selector kinds (`local`/`fake`/`memory`/`off`) to
  demo/optional with the selector env name in `fix.env` and a real docs
  guide in `fix.docHref` — the docHref test pins every link to an actual
  guide slug, so keep `fix.docHref` in `/docs/<existing-slug>` form.
- `accounts.first-workspace` detail references `/onboarding`; the desktop
  updater row is always `optional` info pointing at
  `docs/desktop-updates.md` (the web server can't see Tauri config).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
| 2026-10-16 | Environment rule: only "production" enforces strict APP_URL/AUTH_SECRET — "local"/"test"/"development" all take the dev branches | Devin |
