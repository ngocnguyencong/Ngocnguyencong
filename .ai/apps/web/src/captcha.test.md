# apps/web/src/captcha.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Unit tests for `captcha.ts`: off-provider pass-through, Turnstile siteverify
request shape (secret/response/remoteip), and fail-closed behavior on
missing token, `success:false`, non-200, and network errors. Fetch is
injected via `deps.fetchImpl` — no network in tests.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Fetch mocks typed as `vi.fn<typeof fetch>` so `mock.calls` destructures correctly under strict TS (replaces `as unknown as typeof fetch` casts) | Devin |
| 2026-09-22 | Added | Devin |
