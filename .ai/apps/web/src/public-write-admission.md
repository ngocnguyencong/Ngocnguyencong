# apps/web/src/public-write-admission.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Combines a trusted-proxy-derived client quota with a shared aggregate quota
for public marketing and waitlist writes.

## Security Notes

- Anonymous IP keys come only from `rateLimitKeyForRequest`; spoofable leading
  XFF values and `x-real-ip` are not trusted.
- If no trusted client address is configured/available, the client bucket is
  skipped; the aggregate limiter still gates every write.
- A client denial stops before consuming the aggregate budget. An aggregate
  denial blocks the side effect.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Initial shared admission policy for public write actions | Codex |
