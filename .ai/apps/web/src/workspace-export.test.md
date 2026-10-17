# apps/web/src/workspace-export.test.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Unit suite for `buildWorkspaceExport` using an injected fake drizzle db —
no live Postgres. The fake `select(sel).from(table)` builder projects
fixture rows onto the selected keys exactly like Postgres would, so an
unselected column can never reach the export; `where` conditions are
captured through `PgDialect().sqlToQuery()` for scoping assertions.

## What It Covers

- Documented top-level shape (`format`/`version`/`exportedAt` + all 15
  sections) and empty-workspace defaults.
- Full fixture export — members, pending invitations, content body,
  commerce orders with nested `items`, credits, usage, entitlements,
  audit log.
- Scoping: every recorded where-condition's params contain the
  workspace id.
- Secret exclusion (dual pin): no select list may name a key matching
  `/token|secret|hash|payload|credential|ipAddress|metadata/i`, and the
  serialized export must not contain the fixture's planted secret
  values; per-section `not.toHaveProperty` structural asserts guard
  against empty-section false-positives.
- Normalization: `monthlyBudgetMicrounits` bigint → `"123456789"`, Date →
  ISO, `JSON.parse(JSON.stringify(data))` round-trips unchanged.
- Bounds: 12-period usage counter floor (params arrive as ISO strings —
  the dialect serializes `Date` binds), `.limit(100)` deliveries,
  `.limit(1000)` credit transactions + audit events.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Suite created alongside `workspace-export.ts` (WP8); Date-param assertion fixed for dialect ISO serialization | Devin |
