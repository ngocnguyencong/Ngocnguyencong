# src/entitlements.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Server-only entitlement loaders shared by every surface that needs "what
does the current viewer's workspace hold" — the paywall gate, gated CMS
lists, and any future entitlement-aware surface. `import "server-only"`
keeps it out of client bundles.

## Public API

- `listWorkspaceEntitlements(workspaceId)` — raw `EntitlementRecord[]`
  (`key`, `status`, `expiresAt`) for one workspace; no session logic.
- `listViewerEntitlements()` — full session → active-workspace → rows flow:
  `getAuthSession(await headers())` → `resolveActiveWorkspaceIdForUser` →
  `listWorkspaceEntitlements`. Returns
  `{ entitlements, workspaceId: string | null }`; anonymous viewers (or users
  with no active workspace) get `{ workspaceId: null, entitlements: [] }`,
  which downstream treats as "every gated entry locked".

## Important Notes

- Callers decide policy — this module only loads. Pair with
  `hasActiveEntitlement` (`./entitlement-check`) for boolean checks or
  `applyContentAccess` (`./content-access`) for row projection.
- `resolveActiveWorkspaceIdForUser` already reads the active-workspace
  cookie + `userWorkspacePreference`; do not re-resolve workspaces
  elsewhere. The cookie is pre-existing app-wide trust semantics (it scopes
  the whole workspace UI), but note the paywall now depends on it too —
  switching the active workspace changes which workspace's entitlements
  gate content. Membership validity is enforced downstream by the
  workspace/membership checks, not inside this loader.
- Entitlement keys are a global product vocabulary — `hasActiveEntitlement`
  matches by key name alone. `listViewerEntitlements` scopes rows to the
  ACTIVE workspace only, so there is no cross-workspace bleed through this
  loader; but products that define per-workspace tier names should be aware
  that a `"pro"` row grants whatever `"pro"` means on every surface.

## Dependencies

- `./auth-runtime` — `database`, `getAuthSession`.
- `./organization-actions` — `resolveActiveWorkspaceIdForUser`.
- `@supastack/db` — `entitlement` table.
- `next/headers` — `headers()` (async in Next 16).
- Consumers: `entitlement-gate.tsx`, gated content surfaces.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | Created — session→workspace→entitlements flow extracted from `entitlement-gate.tsx` for reuse by CMS gating | Devin |
