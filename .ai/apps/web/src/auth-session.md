# auth-session.ts

## Purpose

Project a Better Auth SDK session to the minimal server identity used by workspace actions.

## Current behavior

The normalizer requires emailVerified to be exactly true and denies banned users before returning an identity. This closes a legacy unverified session's path into workspace actions. Null remains unauthenticated, malformed SDK identity errors are retained, and the result is a frozen ID-only projection.

## Constraints

Never serialize credentials or extra user data. Native auth recovery remains available through the auth handler; this projection protects app workspace authorization. Regression cases must include missing, false and string verification values, a banned verified user, and a verified user whose identity remains usable.

## Status

Implemented; four negative cases failed before the guard and all six focused tests pass after it. The full workspace test suite also passes. This verifies the session projection locally, without live database or provider integration.
