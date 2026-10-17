# apps/web/src/storage-image-runtime.ts

> Last updated: 2026-10-03 | Protection: HIGH

## Purpose

Server-only composition of the storage image lifecycle with the configured
object store and database.

## Behavior

- Runs stable object replacement and metadata upsert inside a transaction
  protected by `pg_advisory_xact_lock(hashtext(slotKey))` so same-slot writes
  serialize across app instances.
- Uses the unique `(workspaceId, objectKey)` index to update the single
  current row and refresh its MIME, byte count, uploader, and timestamps.
- Selects and removes a capped set of obsolete metadata/objects after the
  replacement commits; avatar cleanup includes the owner, logo cleanup uses
  workspace and purpose.
