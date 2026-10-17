# src/api/client.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Shared JSON client for the cookie-authenticated `/api/*` surface. Every
domain module builds a thin typed wrapper over `request` so the
cookie/error/parse plumbing lives in exactly one place.

## What It Does

- `createMobileApiClient({apiUrl, getCookie}, transport=fetch)` →
  `{ request<T>(path, {body, method, parse}) }`.
- `MobileApiError {status, code}` — reads `{error:{code,message}}` or
  `{error: string}` payloads; throws 401 before the request when the
  session cookie is missing.

## Important Notes

- Only the organization/feature-board BFF routes use the `{data}` envelope;
  the developer-surface routes (`api-keys`, `webhooks`, `schedules`,
  `domains`, `audit`) return flat payloads. Clients parse whichever shape
  their endpoint emits.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
