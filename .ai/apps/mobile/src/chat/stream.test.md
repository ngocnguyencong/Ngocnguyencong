# src/chat/stream.test.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Tests for Expo chat stream request configuration, response parsing, and cancellation.

## Coverage

The request sends model alias and structured-output requirements, forwards an
optional AbortSignal to `expo/fetch`, parses SSE replies, and keeps existing
thread/session behavior.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Verify chat control and cancellation request forwarding | Codex |
