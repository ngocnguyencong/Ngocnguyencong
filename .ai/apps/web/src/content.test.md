# src/content.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Unit tests for `content.ts` domain logic plus source-contract assertions
for `content-actions.ts` (repo convention: action tests assert the source
wires auth/workspace-scope/audit/webhook correctly rather than mocking the
whole DB layer).

## Coverage

- Type/status guards reject unknown values.
- `normalizeEntitlementKey` accepts dotted keys the billing pipeline
  actually grants ("ai.reference-task"); rejects empty/oversized/unsafe
  keys and leading dots.
- `normalizeContentEntryInput` trims, slugifies, bounds lengths, rejects
  empty title and bad type; `requiredEntitlement` trims + lowercases,
  blanks → `null`, missing → `null`, unsafe keys ("pro tier!") error the
  whole draft with a message naming dots.
- `evaluateContentStatusChange` allows draft→published, published→archived,
  archived→published (re-publish); rejects no-ops and unknown targets.
- Source contract: `requireWorkspaceWriter` on every action,
  `eq(contentEntry.workspaceId, …)` scoping, audit actions,
  `content.published` webhook, `revalidatePath("/content")`.
- Access-boundary contract: `listPublishedContentEntries` is absent from
  the `"use server"` module and lives in `server-only` `content-queries.ts`;
  `entitlement-gate.tsx` never touches `@supastack/db`/`database` directly —
  it delegates to `listViewerEntitlements` from `./entitlements`. Pins the
  forgeable-RPC lesson (untrusted caller params must not carry grants).

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-27 | +`normalizeEntitlementKey` describe (dotted-key acceptance, unsafe rejections); error message pinned to mention dots | Devin |
| 2026-09-27 | +`content access boundary contract` describe — pins server-only read boundary + gate→shared-loader delegation | Devin |
| 2026-09-27 | +`requiredEntitlement` normalization cases; full-draft `toEqual` pins the new `requiredEntitlement: null` field | Devin |
| 2026-09-22 | Created | Devin |
