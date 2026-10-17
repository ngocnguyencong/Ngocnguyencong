# apps/web/src/authjs-session.test.ts

## Purpose

Check Auth.js cookie extraction, signature validation, versioned local user ID
decoding, and current user state checks for BFF sessions.

## Security Fix (2026-09-27)

Tests reject signed but unversioned legacy identity tokens while accepting
tokens from the provider-account linking flow. The active-user check rejects
missing, unverified, and banned rows after JWT decoding.
