# apps/web/src/request-body.ts

## Purpose

Shared bounded request-body readers for API JSON, public billing webhooks, and authenticated multipart uploads.

## Open Threads / Resume Context

- `readBoundedJson` defaults to 65,536 bytes. It rejects a declared oversize body before streaming and stops a chunked body on its first over-limit chunk. Chat thread mutations and the development-only local-reference dynamic route use it so their own limits do not depend on proxy matching. Callers map `RequestBodyTooLargeError` to 413 and malformed JSON to 400.
- Billing webhooks have a 1 MiB total cap; image multipart requests have a 2.5 MiB total cap before form parsing. The PayPal route uses a 20-request in-process concurrency gate and a shared-store global rate limit. All seven bounded-read webhook receivers run `readWebhookPayload` inside their `try` so non-`RequestBodyTooLargeError` stream failures reach `captureException` → 500.
- Other fixed-path authenticated JSON routes remain protected by the proxy request clone where the matcher applies; do not assume that protection for dynamic paths containing a dot.


## Auth catch-all body forwarding

- eadBoundedRequest buffers at most MAX_JSON_BODY_BYTES (65,536 bytes) and returns a new request with the original URL, method, content type, and exact body bytes so Better Auth can continue parsing JSON or form-urlencoded input.
- It rejects oversized declared length before reading and stops/cancels chunked or deceptive-length streams at the byte cap with the same generic 413 boundary.
