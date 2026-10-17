# apps/web/src/workspace-export.ts

> Last updated: 2026-10-16 | Protection: STANDARD

## Purpose

Owner/admin workspace data export (`import "server-only"`):
`buildWorkspaceExport(workspaceId, now, db?)` aggregates every
workspace-scoped row into a downloadable JSON document —
`format: "supastack.workspace-export"`, `version: 1`. The `db` parameter is
injectable for tests (defaults to the real `database`).

## What It Does

- Top-level keys: `format`, `version`, `exportedAt`, `workspace`,
  `members`, `invitations`, `content`, `commerce` (`{products, orders}` —
  orders embed `items`), `schedules`, `webhooks` (`{endpoints, deliveries}`),
  `apiKeys`, `domains`, `featureRequests`, `credits`
  (`{balance, transactions, updatedAt}`), `usage` (`{caps, counters}`),
  `aiPolicy`, `entitlements`, `auditLog`.
- Every query is `eq(<table>.workspaceId, workspaceId)` — platform
  `job_schedule` rows (NULL workspaceId) are excluded by the equality
  scope automatically.
- Bounds: 100 latest webhook deliveries, 1000 credit transactions, 1000
  latest audit events, usage counters trimmed to the last 12 monthly
  periods (`gte periodStart` floor computed from `now`, same UTC-month
  model as `usage-quota.ts` `monthStart`). Content/products/orders/
  members/etc. are unbounded — portability exports stay complete.
- `normalizeExportValue` walks the result: `Date` → ISO string,
  `bigint` → decimal string (covers `workspace_ai_policy.
  monthly_budget_microunits`). The returned object is already JSON-safe.

## Important Notes / NEVER Change

- Every `.select({...})` list is explicit — never a wildcard. The banned
  column set is pinned by `workspace-export.test.ts`: invitation `token`,
  `webhook_endpoint.secret`, `webhook_delivery.payload` (may echo
  subscriber secrets), `api_key.keyHash`, `audit_event.metadata`/
  `ipAddress`. Secret-bearing tables (`provider_credential`,
  `connected_account` token envelopes, `session`, OAuth material) are not
  queried at all.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | Workspace data portability export builder (WP8) | Devin |
