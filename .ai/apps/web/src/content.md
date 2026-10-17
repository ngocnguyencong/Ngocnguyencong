# src/content.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Pure, client-safe domain logic for the workspace CMS (`/content`) —
statuses, type/entitlement-key normalization, draft validation, and the
status-change decision table. No database or React imports.

## Behavior

- `CONTENT_ENTRY_TYPES` = `post | page | doc | report` — suggestions for the
  form datalist only; the column accepts any safe product-defined type via
  `normalizeContentType` (1–64 chars, `^[a-z0-9][a-z0-9_-]*$`).
- `CONTENT_ENTRY_STATUSES` = `draft | published | archived`.
- `normalizeEntitlementKey` — 1–100 chars, `^[a-z0-9][a-z0-9._-]*$` —
  looser than the type alphabet because keys are equality-compared
  identifiers, not URL segments (dots allowed; matches the flag-key
  alphabet and shipped grants like `ai.reference-task`). Shared by draft
  normalization and reusable anywhere an entitlement key enters from user
  input.
- `normalizeContentEntryInput` trims title/slug/body/excerpt, slugifies the
  slug (`./slug`, falls back to title), lowercases locale (≤35), and
  normalizes `requiredEntitlement`: trim + lowercase, blank → `null`
  (ungated), non-blank must satisfy `normalizeEntitlementKey` or the whole
  draft errors — a typo'd key must never silently publish an open entry.
  Returns `ContentEntryDraft | { error }` (draft includes
  `requiredEntitlement: string | null`).
- `evaluateContentStatusChange(current, next, now)` — lifecycle is free
  (draft ↔ published ↔ archived); only no-ops and unknown targets reject.
  `publishedAt` stamps on first publish and survives later unpublishes so
  readers keep the original date.

## Dependencies

- `./slug` — `slugify` (lowercase, hyphenated, collision-safe base).
- Consumers: `content-actions.ts`, `web-content-page.tsx`, `content.test.ts`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | `normalizeEntitlementKey` alphabet widened to `^[a-z0-9][a-z0-9._-]*$` (dots — shipped grants like `ai.reference-task` were unenterable); error message now names dots | Devin |
| 2026-09-27 | +`"report"` type suggestion; `ContentEntryDraft` +`requiredEntitlement`; `normalizeEntitlementKey` extracted; draft errors on unsafe non-blank key | Devin |
| 2026-09-22 | Created for workspace CMS (buyer requirement: CMS capability) | Devin |
