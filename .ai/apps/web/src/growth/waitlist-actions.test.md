# apps/web/src/growth/waitlist-actions.test.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Server-action regressions for the public waitlist admission gate and generic
duplicate response.

## Coverage

- An exhausted shared admission gate redirects before calling `joinWaitlist`.
- Duplicate joins redirect with only `waitlist=duplicate`, never rank or
  referral-code query parameters, and do not emit a created-entry audit.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Initial waitlist action security regressions | Codex |
