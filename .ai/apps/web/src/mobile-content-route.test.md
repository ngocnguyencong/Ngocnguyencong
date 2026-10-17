# apps/web/src/mobile-content-route.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Route plumbing tests for `app/api/mobile/content/route.ts` and
`app/api/mobile/content/[entryId]/route.ts` — `./content-actions` and
`./workspace-access` are mocked so only HTTP delegation/JSON mapping is
exercised (mirrors `mobile-push-tokens-route.test.ts`).

## What It Does

- GET: entries serialize Date → ISO (null `publishedAt` preserved);
  error results map to 401/403.
- GET [entryId]: returns the entry WITH `body` + ISO dates; unknown id
  → 404; access errors map to 401/403.
- POST: `requireWorkspaceWriter` runs before the body is consumed;
  fields forward to `createContentEntryAction`; 201 `{entryId}` / 422 /
  400 malformed.
- PATCH: string fields → `updateContentEntryAction`; `{status}` →
  `setContentEntryStatusAction` FormData bridge; update failure skips
  the status leg (422); unknown status / empty body → 400.
- DELETE: writer role required; FormData bridge → `{ok:true}`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | `getEntry` mock replaces `listEntries` for item-GET cases; call-arg assertion added | Devin |
| 2026-10-13 | += `[entryId]` GET coverage; rest-sibling destructure lint fix | Devin |
| 2026-10-12 | Created | Devin |
