# profile-handler.test.ts

## Purpose

Real memory-adapter profile ownership, origin and session regression tests.

## Decisions

- Create each account by consuming a captured email OTP; direct password signup is disabled. Keep the existing name persistence and isolation assertions.
- Supply explicit test-only mail admission so this memory-adapter integration
  continues to focus on profile authorization and persistence.
