# src/ui/offline-notice.tsx

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

`<OfflineNotice savedAt>` — the shared banner screens render once when a
read resolved from the offline cache (`source === "cache"`), so stale
content is visibly labeled.

## What It Does

- Text: "You're offline — showing data saved {relative time}." where the
  relative part is just now / N minutes|hours|days ago.
- `accessibilityRole="alert"` announces it to assistive tech — render at
  most once per screen.
- Colors come from the session `palette` (`telemetry` text on
  `telemetrySoft` field, `outline` border) — no hard-coded hex.

## Dependencies

- `useRequiredMobileApp` from `../session/provider` for the theme
  palette.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for mobile offline reads (WP6) | Devin |
