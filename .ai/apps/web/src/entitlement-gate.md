# src/entitlement-gate.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Server-component paywall gate: renders `children` when the viewer's active
workspace holds `entitlementKey`, otherwise `fallback` or a built-in
"Upgrade required" card linking to `/billing`.

## Behavior

- Delegates the whole session → active workspace → entitlement rows flow to
  `listViewerEntitlements()` (`./entitlements` — itself `server-only`), then
  decides with the pure `hasActiveEntitlement` (`./entitlement-check`).
- Anonymous viewers get `entitlements: []` → gate shows the upgrade state.
- No `"use server"` directive — it is a server component imported by pages,
  not an action.

## Dependencies

- `./entitlements` — `listViewerEntitlements`.
- `./entitlement-check` — `hasActiveEntitlement`, `EntitlementRecord`.
- `entitlement-gate.test.ts` covers the pure check, not the component.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Inline session/workspace/entitlement query replaced by shared `listViewerEntitlements` — no behavior change; mirror created (file predates the mirror convention) | Devin |
