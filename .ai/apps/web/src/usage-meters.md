# src/usage-meters.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

The usage-meter catalog shown on Settings → Usage and the mobile usage
card: `usageMeters(plans)` returns the shipped `ai.requests` meter plus
every key any plan declares in `usageLimits` (label falls back to the raw
key) so derived products get cap controls for their plan meters
automatically. `USAGE_METERS` is the frozen default-catalog instance.

## Important Notes

- Dedup by key: a plan-declared `ai.requests` does not double the row.
- The catalog drives both UI rows and action validation —
  `usage-actions.ts` rejects `setUsageCapAction` keys not in `USAGE_METERS`,
  so adding a meter key to a plan automatically makes it cap-able.
- Pure module (no `server-only`) — safe to import from the settings page
  and tests.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
