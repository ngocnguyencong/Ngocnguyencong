# github-connection.ts

> Last updated: 2026-09-23 | Protection: CRITICAL

## Purpose

Resolve the signed-in user's Better Auth GitHub account link into a public dashboard view model without exposing OAuth access tokens to the browser.

## Security Invariants

- OAuth tokens remain server-only and are never returned.
- Auth.js reports linking as unavailable; it does not merge identities.
- Only public profile fields reach the dashboard component.

## Open Threads / Resume Context

- **Status:** in_progress
- **Intent:** Add generic GitHub linking to the production dashboard only.
