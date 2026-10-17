# src/setup-readiness.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit coverage for `evaluateSetupReadiness`: every check's status mapping
(db unreachable / pending / unreadable migrations, APP_URL explicitness +
prod localhost-http rule, auth-secret length + dev-default demo, sign-in
method listing, OAuth placeholder flagging, admin bootstrap, first
workspace, provider demo/optional/ready mapping, product brand/style/
social-card, platform rows), action-first ordering, status counts,
`readyForProduction` edge cases, a no-secret-serialization guard, and a
`fix.docHref` → real-guide-slug resolution test.

## Important Notes

- The docHref test regexes both guide shapes: `slug: "…"` literals in
  `content.ts` and `guide("…")` calls in `additional-guides.ts`.
- Fixtures: `readySnapshot()` (fully configured production) and
  `freshCloneSnapshot()` (dev defaults) — extend both when adding checks.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for the /setup readiness checklist (WP3) | Devin |
| 2026-10-16 | +"local"/"test" environment cases for app-url and auth-secret checks | Devin |
