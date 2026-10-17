# apps/web/src/public-write-admission-runtime.ts

> Last updated: 2026-10-03 | Protection: STANDARD

## Purpose

Server-only limiter composition for public marketing and waitlist write
actions. Uses a shared 5/hour trusted-client bucket and the existing shared
100/hour marketing aggregate bucket, both fail-closed.

## Important Notes

- Both buckets use `createNamedRateLimiter`, which defaults to the shared
  Postgres rate-limit store in production and memory outside production.
- Only configured trusted-proxy identities receive the per-client bucket.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Initial server limiter composition for public write actions | Codex |
