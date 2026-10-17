# src/content-actions.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

`"use server"` actions for the workspace CMS. Every mutating action goes
through `requireWorkspaceWriter()` (member+; guests read-only) and scopes
every query by the resolved `workspaceId`.

## Behavior

- `listContentEntries()` — writer-gated list for `/content`, newest first;
  selects `requiredEntitlement` so the admin can show the gate badge.
- `createContentEntryAction` / `updateContentEntryAction` — validate via
  `normalizeContentEntryInput` (input gains `requiredEntitlement?: string`,
  persisted on create and set unconditionally on update — blank clears the
  gate); slug unique per (workspace, type) via
  `idx_content_entry_workspace_type_slug`, surfaced as a friendly error
  via the 23505 `isUniqueViolation` catch. Audit:
  `content_entry.created` / `content_entry.status_changed` /
  `content_entry.deleted`.
- `setContentEntryStatusAction` — `evaluateContentStatusChange` decides
  the next `status` + `publishedAt` (first-publish stamp preserved across
  unpublishes); publishing emits the `content.published` workspace webhook.
- `deleteContentEntryAction` — hard delete at any status.
- All mutations `revalidatePath("/content")`.

## Important Notes / NEVER Change

- Every export here is a public POST endpoint (`"use server"`) — parameters
  are untrusted client input. **Never accept trust-bearing params
  (entitlements, roles, session claims) on an export** — a caller could
  forge them. That exact hole (`viewerEntitlements` on
  `listPublishedContentEntries`) is why the public published-read moved to
  `server-only` `./content-queries`; do NOT re-export it here. The
  "content access boundary contract" in `content.test.ts` pins this.

## Dependencies

- `./workspace-access` — `requireWorkspaceWriter`.
- `./webhook-events` + `webhook-delivery` — `content.published` emit.
- `@supastack/db` — `contentEntry`, `writeAuditEvent`.
- Related: `./content-queries` — server-only public published read
  (`listPublishedContentEntries`, `PublishedContentEntry`).

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-10-13 | += `getContentEntry(entryId)` — single-row writer-gated fetch (mobile GET route); projection + status-normalizer shared via `CONTENT_ENTRY_PROJECTION`/`toContentEntryRow` | Devin |
| 2026-09-27 | `listPublishedContentEntries` moved to `server-only` `./content-queries` — caller-supplied `viewerEntitlements` on a `"use server"` export was client-forgeable | Devin |
| 2026-09-27 | `requiredEntitlement` persisted end-to-end (create/update/select); published read strips locked bodies per `viewerEntitlements` | Devin |
| 2026-09-27 | `isUniqueViolation` extracted into shared `./db-errors` (prod-ready-kit merge) | Devin |
| 2026-09-22 | Created | Devin |
