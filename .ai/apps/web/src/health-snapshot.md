# apps/web/src/health-snapshot.ts

## Purpose

Shared server-side health snapshot used by the health API and status page.

## Security Fix (2026-09-27)

Shared server-only snapshot probes database health and reports configured provider kinds to both the JSON API and status page; it does not perform a network self-fetch.
