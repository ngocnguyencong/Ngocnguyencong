# auth-session.test.ts

## Purpose

Test the minimal verified Better Auth session projection used by workspace actions.

## Coverage

Retain null and malformed SDK cases. Require exact verified proof and deny banned sessions; valid verified users still produce a frozen ID-only identity, never session tokens or email fields.

## Status

Implemented: four negative cases failed before the guard; all six cases pass with exact mailbox proof and ban checks.
