# apps/web/src/auth-otp-delivery.test.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose

Unit tests for localized pre-auth OTP and magic-link adapters and the injected recipient limiter.

## Coverage

- OTP sign-in and password-reset messages have the exact transactional
  pre-auth shape, including localized language and footer metadata.
- Magic-link messages preserve the verify URL, and a German locale localizes
  the subject, body, language tag, and footer.
- The injected five-per-hour limiter is shared between OTP and magic-link
  sends. Case variants use one recipient bucket; a rejected admission never
  invokes delivery, while another recipient remains unaffected.

## Scope

This unit suite tests adapter mapping and admission-before-delivery. Better
Auth's `hooks.before` ordering relative to token persistence is exercised by
the auth handler regressions, not by this adapter-only test.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-04 | Clarify adapter coverage separately from Better Auth persistence ordering | Codex |
| 2026-09-22 | Assert localized message metadata and shared recipient admission | Devin |
