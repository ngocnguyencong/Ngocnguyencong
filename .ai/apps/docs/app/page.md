# apps/docs/app/page.tsx

> Last updated: 2026-10-06 | Protection: STANDARD

## Purpose

The standalone setup-docs site's only page (dev port 3001). Renders the
three `setupGuidance` blocks — `local`, `agent`, `providers` — as ordered
sections plus the credential warning footer. All copy lives in
`apps/docs/src/setup-content.ts`; this file is presentation only.

## Important Notes

- Keep it dumb: no new copy here — extend `setupGuidance` in
  `setup-content.ts` so `setup-content.test.ts` stays the single source of
  assertions.
- The `agent` section must stay in lockstep with `docs/agent-setup.md`
  (see `.ai/apps/docs/src/setup-content.md`).
- `apps/docs` never ships to the sub-repos; monorepo-facing references are
  fine here.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-06 | Mirror created retroactively — page gained the `agent` SetupSection earlier the same day | Devin |
