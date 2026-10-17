# apps/web/src/workspace-export-card.test.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Two-layer pin for the Settings → General export card.

## What It Covers

- `renderToStaticMarkup` of `WorkspaceExportCard`: emits an `<a>` to
  `/api/workspace/export` (no-JS download path) with the localized
  title/action copy.
- Source pin on `web-settings-page.tsx`: the card renders only inside
  `canExportWorkspace && workspaceExportCopy` — members/guests never see
  it. (The real authorization boundary is the route's 403, covered by
  `route.test.ts`.)

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Card render + gating pin tests (WP8) | Devin |
