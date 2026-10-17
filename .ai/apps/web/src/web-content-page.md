# src/web-content-page.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Client UI for `/content` (+ `/[locale]/content`) — the workspace CMS
surface. Entry list with status badges + per-row publish/archive/delete
actions, and a create/edit form (title, type, slug, locale,
requiredEntitlement, excerpt, body).

## Behavior

- Renders inside `WorkspaceShell`; loads rows via `listContentEntries`.
- Status actions submit `FormData` to `setContentEntryStatusAction` /
  `deleteContentEntryAction`; create/edit call the typed actions.
- Field errors from the actions render inline (union result type), never
  thrown to an error boundary.
- Auth hint: page explains members can author; guests see a read-only note
  when the action returns the writer-gate error.
- `requiredEntitlement` gates a published entry behind a workspace
  entitlement. The form field carries `defaultValue={editing?.requiredEntitlement
  ?? ""}` and submits on every save — `updateContentEntryAction` writes the
  field unconditionally (omitted → `null`), so the input MUST always submit
  the current value or editing an entry would silently clear its gate.
  Blank = free for all readers; an `ai.reference-task` datalist option
  hints the shipped plan-grant key (see `ProductPlan.entitlement`).
  Gated entries show a third `status-badge` next to type.

## Dependencies

- `./content` — `CONTENT_ENTRY_TYPES`, status labels.
- `./content-actions` — server actions + `ContentEntryRow` type.
- `./app-chrome` — `WorkspaceShell`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | datalist/placeholder `pro` → `ai.reference-task` — the suggestion is now a key the shipped plans actually grant | Devin |
| 2026-09-27 | +`requiredEntitlement` form field (always submits, preserves the gate on edit) + entitlement badge on gated rows | Devin |
| 2026-09-22 | Created | Devin |
