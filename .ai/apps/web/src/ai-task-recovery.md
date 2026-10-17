# apps/web/src/ai-task-recovery.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Shared builder for AI-task recovery redirects. Historically shared
`?taskId`/`?submissionKey` links pointed at routes that no longer host the
console (`/`, `/dashboard`, `/{locale}/dashboard`, `/{locale}/ai` for `en`);
`taskRecoveryHref(query, consolePath = "/ai")` returns
`"{consolePath}?taskId=…&submissionKey=…"` when at least one recovery param is
present, else `null`, so every entry point forwards identically.

## Important Notes

- Multi-value params (`string[]`) are dropped, not truncated to the first
  element — recovery links only ever carry a single value; preserve this.
- Values are URL-encoded via `URLSearchParams`.
- Pass a localized `consolePath` (`localePath(locale, "/ai")`) for the
  `/{locale}/dashboard` forward; the `en` → `/ai` redirect in
  `app/[locale]/ai/page.tsx` uses the return-`null` fallback to render the
  canonical path bare when no recovery params exist.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | Exported `firstSearchParam` (replaces quadruplicated local `first`); localized landing now forwards recovery params (`/en?taskId` → `/ai`, `/de?taskId` → `/de/ai`); localized dashboard shim forwards `site`/`period` to `/dashboard` | Devin |
| 2026-10-13 | Extracted from the three duplicated call-site blocks (root page, canonical + localized dashboard shims) | Devin |
