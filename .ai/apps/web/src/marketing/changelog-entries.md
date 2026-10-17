# apps/web/src/marketing/changelog-entries.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Curated public changelog data for `/changelog`: a typed
`MarketingChangelogEntry` list (`date`, `title`, `points`) rendered by
`ChangelogPage` through the `changelog-timeline` kit block. Newest first,
unique ISO dates.

## Important Notes

- Entries are hand-curated buyer-facing outcomes reconstructed from the
  repo's shipped history — no implementation internals, root causes, or
  third-party product names. Each `date` must stay unique (the timeline
  uses it for the `Latest` badge logic by position, not key).
- `changelogEntries` is a plain const export — no DB, no fetch, so the
  page stays statically derivable and SSR-safe.
- The type is named `MarketingChangelogEntry` on purpose — the kit block's
  own `ChangelogEntry` (`changelog-timeline.tsx`) is a different shape
  (`meta/title/points` render props vs `date/title/points` data).
- `formatChangelogDate(date, locale)` formats through `Intl.DateTimeFormat`
  with the BCP-47 tag for the `AppLocale` (en→en-US, de→de-DE, es→es-ES,
  fr→fr-FR), always in UTC.
- Update this file when shipping user-visible capabilities; keep bullets
  outcome-worded ("you can now…"), one idea per bullet.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | `2026-10-16` entry replaced 7→9 points with the owner-authored canonical text, retitled "A ready-to-build kit: setup checklist, usage limits, offline mobile, and new styles" — adds workspace data export + desktop beta update channel points; header point reworded with a `Fixed:` prefix | Devin |
| 2026-10-16 | `2026-10-16` entry expanded 1→7 points, retitled "A more finished kit: setup checks, usage limits, offline mobile, and new styles" — same-day fold of `/setup` checklist, usage budgets/caps, polished analytics dashboard, 5 new packs + 5 styles, mobile offline reads, and automatic stale push-token pruning; header point retained | Devin |
| 2026-10-16 | New `2026-10-16` entry ("A steadier site header", kind `fixed`, surfaces `["web"]`) — site header shows the right account button immediately, no flicker | Devin |
| 2026-10-13 | `2026-10-13` entry grown 6→7 points — appended the day's later mobile batch: profile-name editing under Settings → General, API keys with expiry + per-key created/last-used/expiry details, full content-entry editing incl. body | Devin |
| 2026-10-13 | New `2026-10-13` entry (6 points): dedicated `/ai` console route, nav-link/recovery/budget-notification routing, localized settings data, dead admin link removed, mobile + desktop catch-up | Devin |
| 2026-10-11 | Type renamed `ChangelogEntry`→`MarketingChangelogEntry` (kit-block collision); `formatChangelogDate` gained the `AppLocale` param for localized date rails | Devin |
| 2026-10-10 | Created: 11 entries covering REST API, AI tasks, theming, notifications, scheduling, commerce/CMS, platforms | Devin |
