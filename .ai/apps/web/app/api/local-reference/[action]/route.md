# apps/web/app/api/local-reference/[action]/route.ts

## Purpose

Local fake reference API for authentication, task execution, and hydration.
It backs the reference dashboard in development and tests.

## Important Notes

- The authenticate action creates process-memory sessions without a normal
  sign-in. The local flow must remain available in development and tests.

## Security Fix (2026-09-27)

GET and POST return 404 immediately in production, before local fake authentication or in-memory task state can be reached.

## Security Fix (2026-10-03)

- Development POST bodies use the shared 65,536-byte bounded JSON reader; oversized bodies return 413. Production continues to return 404 before reading the body.
