# apps/web/app/api/chat/threads/[threadId]/messages/route.ts

## Purpose

Append an owned chat message.

## Security Fix (2026-09-27)

- Requires workspace write access before accepting message content.

## Security Fix (2026-10-03)

- Message JSON is limited to 65,536 bytes with `readBoundedJson`; oversized bodies return 413 and malformed JSON returns 400. The route owns this bound because dotted dynamic IDs can bypass proxy matching.
