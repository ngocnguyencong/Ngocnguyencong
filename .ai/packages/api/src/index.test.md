# packages/api/src/index.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Contract tests for the public `/api/v1` zod schemas and the generated
OpenAPI document: camelCase resource parsing, snake_case rejection,
error envelope shape, registered path/response structure, and the
entitlement status domain (`active`/`trialing`/`past_due`/`inactive`
accepted; legacy `gracePeriod`/`expired`/`revoked` rejected).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Entitlement status domain coverage added | Devin |
