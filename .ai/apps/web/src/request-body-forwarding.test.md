# apps/web/src/request-body-forwarding.test.ts

## Purpose

Verify bounded auth-body forwarding preserves parser input and rejects over-limit requests before delegation.

## Coverage

- Exact JSON and form-urlencoded bytes and content types survive forwarding.
- Declared oversize input is rejected before its stream is read.
- Actual oversize streamed bytes are rejected and the stream is cancelled.
