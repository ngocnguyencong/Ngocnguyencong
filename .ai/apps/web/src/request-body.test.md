# apps/web/src/request-body.test.ts

## Purpose

Focused streaming-body limit tests for bounded JSON, webhook text, and multipart uploads.

## Open Threads / Resume Context

- Tests cover chunked and declared oversize rejection, valid and malformed bounded JSON, valid webhook text and multipart fields, and concurrency slot release after verification.

- Auth forwarding preserves raw JSON and form-urlencoded bytes and content type; an oversized auth body returns 413 before Better Auth is called.
