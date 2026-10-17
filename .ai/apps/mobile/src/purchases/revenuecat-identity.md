# src/purchases/revenuecat-identity.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Serializes RevenueCat identity selection and a store operation so concurrent
workspace changes cannot run a purchase under another workspace identity.

## Important Notes / NEVER Change

- Every operation uses the server-returned opaque workspace app user ID.
- Never start a store operation until the requested identity is configured.
- RevenueCat configuration is process-wide; subsequent workspace IDs use `logIn`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Serialize configure/login with each workspace operation | Codex |
