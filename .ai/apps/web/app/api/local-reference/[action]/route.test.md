# apps/web/app/api/local-reference/[action]/route.test.ts

## Purpose

Regression tests for local-reference route exposure.

## Security Fix (2026-09-27)

Tests prove production GET/POST return 404 without fake state access and development POST remains usable.

## Security Fix (2026-10-03)

Tests prove development POST rejects an actual streamed JSON body over the limit, even with a dishonest short content-length, before local authentication state is created.
