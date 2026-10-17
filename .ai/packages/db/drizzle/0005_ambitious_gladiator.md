# packages/db/drizzle/0005_ambitious_gladiator.sql

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Migration: `workspace_domain` table for custom domains (phase B3) —
`id`, `workspace_id` (FK cascade), unique `hostname`,
`provider_hostname_id`, `status`, `ssl_status`, `verification` (jsonb),
`last_checked_at`, `verified_at`, `created_at`, `updated_at`; indexes on
hostname (unique), workspace_id, status.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Generated via `pnpm --filter @supastack/db db:generate` | Devin |
