# audit.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose（一句话人话）

Audit-action 常量表 + `createAuditEventRecord` 纯构造函数 + `describeAuditEvent`
人类可读标签 —— 所有 workspace 问责事件的唯一命名来源。

## What It Does

- `AUDIT_ACTIONS` — frozen map of `camelCase` key → `dot.separated` action
  string. Every `recordAuditEvent` call uses one of these.
- `createAuditEventRecord({createId, now}, input)` — null-fills optional
  fields; pure, unit-testable.
- `describeAuditEvent` — `ACTION_LABELS` lookup with raw-action fallback; used
  by the settings audit log.

## Important Notes / NEVER Change

- New module actions must be added to BOTH `AUDIT_ACTIONS` and
  `ACTION_LABELS` (audit-log UI shows labels).
- Action strings are append-only — shipped values are part of stored history.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | +`workspace.data_exported` (`workspaceDataExported`, "Workspace data export downloaded") for `GET /api/workspace/export` — distinct from the personal export's `workspace.export_downloaded` | Devin |
| 2026-10-16 | +`workspace.ai_budget_updated` / `workspace.usage_cap_updated` (Settings → Usage owner/admin controls; labels `ACTION_LABELS.workspaceAiBudgetUpdated`/`workspaceUsageCapUpdated`) | Devin |
| 2026-10-11 | +`admin.credits_granted` (admin credit grant into a workspace pool) | Devin |
| 2026-09-22 | +`workspace_domain.added/verified/removed` (custom domains) | Devin |
| 2026-09-22 | +`waitlist.joined/invited/removed` + `early_access_code.created/redeemed` (growth module) | Devin |
| 2026-09-22 | +`feature_request.created/status_changed/deleted` for the feedback board | Devin |
