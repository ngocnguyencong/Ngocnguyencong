# apps/web/src/storage-runtime.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Tests memory and S3 object-storage composition.

## Important Notes

- `server-only` is mocked before the runtime's dynamic import.
- The first test loads storage-runtime cold. Full-suite parallel disk work on Windows can push this import beyond Vitest's 5-second default even though isolated behavior passes.

## Open Threads / Resume Context

- Complete. Only the cold-import test has a 15-second timeout. The full unit suite passed after the change.
