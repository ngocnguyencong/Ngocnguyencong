# apps/web/src/storage-image-lifecycle.ts

> Last updated: 2026-10-03 | Protection: HIGH

## Purpose

Replace workspace avatars and organization logos without accumulating an
unbounded sequence of timestamped image objects. Server-only runtime owns the
database and storage adapters; this module defines the lifecycle boundary.

## Security and lifecycle rules

- Avatar's stable slot is `(workspaceId, userId, purpose=avatar)`; its object
  key contains the workspace and user-derived safe filename. Logo's stable
  slot is `(workspaceId, purpose=logo)` and is shared by both authorized logo
  upload paths.
- A database transaction takes a transaction-scoped advisory lock for the
  logical slot before writing the stable object and upserting its metadata.
  Concurrent writers to that slot are serialized across app instances.
- Metadata conflict handling targets the unique `(workspaceId, objectKey)`
  index and refreshes uploader, MIME type, size, and timestamps.
- Legacy object cleanup is capped per upload. Avatar rows are selected only
  for the same workspace, user, and purpose; logo rows only for the same
  workspace and purpose. The current key is excluded. A delete failure leaves
  metadata for a later retry and does not undo a successful replacement.

## Important notes

- Do not use timestamps or random per-upload keys for current avatar/logo
  objects; the stable slot bounds storage growth under repeated uploads.
- Keep authorization in the caller and derive workspace/user scope from its
  verified session and membership. Never accept either identity from the
  uploaded form as authority.
- The per-request cleanup cap bounds latency; legacy rows beyond the cap are
  removed over later successful replacements.
