# src/mobile-feature-board-bff.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Contract tests for `createMobileFeatureBoardBff` — the framework-free BFF
behind `/api/mobile/feature-requests*` — with injected in-memory deps.

## Coverage

- 401 when the session dep returns null; 403 when the workspace dep finds
  no membership; `canWrite:false` for guest role.
- `list` returns requests + `myVoteIds` + `canWrite` envelope.
- `create` validates input (400 on bad title), returns 201 with the new
  request; author vote applied by the store dep.
- `vote` toggles and returns `{ voted, voteCount }`; 404 for unknown ids.
- Error envelope shape: `{ error: { code, message } }` on failures.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-22 | Created with the mobile feature board BFF | Devin |
