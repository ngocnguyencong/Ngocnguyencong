# apps/web/src/storage-upload-admission.test.ts

> Last updated: 2026-10-03 | Protection: HIGH

## Purpose

Pin limiter namespaces, fail-closed configuration, trusted identity keys,
multi-level admission, and retry-delay behavior for storage image uploads.

## Coverage

- User/workspace/global buckets are all checked using the authenticated scope.
- Any exhausted bucket rejects; the returned retry delay covers the
  rejecting buckets. Successful admission requires all buckets to allow.
