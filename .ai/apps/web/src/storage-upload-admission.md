# apps/web/src/storage-upload-admission.ts

> Last updated: 2026-10-03 | Protection: HIGH

## Purpose

Fail-closed admission for authenticated avatar and logo uploads before API
multipart parsing or server-action image byte copying.

## Behavior

- Checks a user bucket scoped by both verified `workspaceId` and `userId`, a
  workspace bucket, and a deployment-wide bucket.
- Each fixed-window limiter is created with `failClosed: true`; configured
  Postgres-store errors reject admission. Local memory limiters retain their
  existing bounded bucket cap.
- A denied result includes the largest retry delay among rejecting buckets.
  Routes return HTTP 429 with `Retry-After`; the organization form redirects
  to its upload-rate-limited status.
- This module receives trusted identities from the authenticated caller and
  does not parse client-provided workspace or user values itself.
