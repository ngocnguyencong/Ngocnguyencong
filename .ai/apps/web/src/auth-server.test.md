# apps/web/src/auth-server.test.ts

## Purpose

Verifies the web wrapper forwards validated configuration and injected
server-only auth resources to the auth package without exposing secrets.

## Open Threads / Resume Context

- **Status:** implemented (2026-10-04)
- **Result:** The wrapper fixture supplies the required mail-admission allow
  stub; the focused auth-server test passes without exposing provider secrets.
