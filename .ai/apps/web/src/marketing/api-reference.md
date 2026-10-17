# apps/web/src/marketing/api-reference.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

OpenAPI → page-view-model transform for `/api-reference`.
`apiReferenceGroups()` walks `openApiDocument.paths` (the same registry
the JSON route serves), groups operations by OpenAPI tag, and returns
`{ method, path, summary, auth }` rows so the page never hardcodes an
endpoint inventory.

## Important Notes

- `auth` is an `ApiReferenceAccess` kind — `"session-or-key"` or `"public"`.
  Every registered /api/v1 route resolves a Bearer `sk_` key first and
  falls back to the app session, so `session-or-key` is the default; an
  explicit empty `security: []` classifies `public` (none exists in the
  generated document today). The page maps kinds to localized labels via
  `RESOURCE_COPY[].apiReference.accessLabels` — the transform itself emits
  no display strings.
- Path items and operations are null-guarded: `paths` values can be
  undefined and a PathItem can carry present-but-empty members
  (`{ get: undefined }`) or non-operation keys (`parameters`) — anything
  that isn't an HTTP-method key with a real operation object is skipped.
- Summary falls back to the operation description so rows always render
  text even if upstream docs are sparse.
- Endpoint order follows the document's path order; tag grouping order
  follows first-seen tags. Add a tag to an operation in the API package
  and it appears here automatically — that's the drift-proofing intent.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `auth` became an `ApiReferenceAccess` kind for localized labels; nullish path-item/operation guards added | Devin |
| 2026-10-10 | Created for the public `/api-reference` route | Devin |
