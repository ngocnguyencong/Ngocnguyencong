# apps/web/src/marketing/leads-actions.test.ts

## Purpose

Server-action regression tests for public lead submission gates.

## Security Fix (2026-09-27)

Tests cover per-client/global denial for contact and newsletter before mail,
trusted-proxy-derived identities, and an ordinary successful contact redirect.
