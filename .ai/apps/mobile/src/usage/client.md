# src/usage/client.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Typed mobile client for `GET /api/mobile/usage` —
`createMobileUsageActions(api).get()` returns the workspace usage overview
(`WorkspaceUsageOverview`: AI budget/spend in microunit strings, per-meter
`{used, planLimit, cap, limit}`, credit balance, UTC period bounds).

## Important Notes

- Strict validation like `src/credits/client.ts`: the ai/credits payloads
  must be present, microunits must match `^\d+$`, `credits.balance` must
  be a number — malformed envelopes throw "The workspace usage was
  invalid."
- Malformed meter *rows* are dropped instead of failing the payload — a
  bad optional row should not blank the whole card; required fields
  (`key`, `label`, `used`) drop the row when missing.
- Read-only by design: caps/budget are managed on the web app; the billing
  screen shows "Manage limits on the web app."

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-16 | Created for workspace usage controls (WP2) | Devin |
