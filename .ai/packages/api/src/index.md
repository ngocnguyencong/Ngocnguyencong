# packages/api/src/index.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Published `/api/v1` contract: zod schemas (`apiErrorSchema`,
`currentWorkspaceSchema`, `entitlementSchema`,
`modelRequirementsSchema`, `createAiTaskRequestSchema`, `aiTaskSchema`,
`aiTaskResultSchema`) registered with `@asteasolutions/zod-to-openapi`
to generate the OpenAPI 3.1 `openApiDocument` served by
`/api/v1/openapi`. Also re-exports `local-golden-path`.

## Important Notes

- `entitlementSchema.status` must mirror the persisted billing domain —
  `BillingEntitlementStatus` in `packages/db/src/repositories.ts`
  (`active`/`trialing`/`past_due`/`inactive`). The web runtime maps any
  unknown stored status to `"inactive"`, so the enum never needs to grow
  ahead of the DB layer.
- All resource fields are camelCase (workspaceId, taskId, expiresAt);
  error envelopes are `{ error: { code, message, requestId, details? } }`.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | Published entitlement enum didn't match reality | Schema declared `gracePeriod`/`expired`/`revoked`, which the billing layer never writes, while real `trialing`/`past_due`/`inactive` rows were rejected upstream | Enum aligned to `active`/`trialing`/`past_due`/`inactive` |

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Created — entitlement status enum realigned to the billing domain | Devin |
