# apps/web/src/storage-image-lifecycle.test.ts

> Last updated: 2026-10-03 | Protection: HIGH

## Purpose

Exercise stable image replacement, owner scoping, bounded legacy cleanup, and
same-slot concurrency with in-memory storage and repository adapters.

## Coverage

- Repeated replacement overwrites one stable avatar/logo object and upserts
  one metadata row with current content details.
- Avatar cleanup cannot delete another user's, another workspace's, or a
  different-purpose object. Logo cleanup is workspace/purpose scoped.
- Cleanup deletes no more than the configured batch per upload and leaves
  failed-deletion metadata available for a later retry.
- Concurrent replacement calls for one logical slot run through the shared
  lock boundary and preserve a single object and metadata slot.
