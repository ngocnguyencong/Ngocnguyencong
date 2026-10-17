# apps/mobile/src/content/client.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Vitest coverage for `createMobileContentActions` over a stub
`MobileApiFetch` transport.

## What It Does

- `list` filters malformed/unknown-status rows, reads `writable`, throws
  on a structurally invalid payload.
- `get` GETs the entry route and requires a string `body` — the edit
  form's prefill contract; body-less/malformed payloads throw.
- `create` POSTs fields and unwraps `{entryId}`.
- `update`/`setStatus` PATCH the entry route; `remove` DELETEs it
  (path/method assertions via captured requests).

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += `get(entryId)` coverage | Devin |
| 2026-10-12 | Created | Devin |
