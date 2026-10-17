# schema.ts

> Last updated: 2026-10-02 | Protection: CRITICAL

## Purpose（一句话人话）

Postgres 全部表结构的 Drizzle 定义 —— Better Auth 核心表 + 工作区/计费/AI 等 Core V1 表的唯一事实来源。

## What It Does

- `pgTable` definitions for every table; `createdAt`/`updatedAt` helpers emit `timestamptz default now()`.
- Better Auth tables (`user`, `session`, `account`, `verification`, `two_factor`, `passkey`) must satisfy `@better-auth/core`'s `getAuthTables` contract — the drizzle adapter validates our table objects against it at write time (`checkMissingFields`), NOT against the database.
- Index names follow `idx_{table}_{columns}`; uniques via `uniqueIndex`.
- `waitlist_entry.created_at` has a standalone B-tree index for the FIFO rank
  count. The admin `(status, created_at)` index cannot serve that query
  because rank counts entries across every status.

## Dependencies

- **External:** `drizzle-orm/pg-core`
- **Consumers:** `packages/auth` (drizzleAdapter `schema`), `packages/db` repositories, `drizzle-kit generate`.

## Open Threads / Resume Context

- 2026-09-22 — Added growth tables: `waitlist_entry` (email unique,
  waiting→invited→joined, `referral_code` unique, self-FK
  `referred_by_entry_id` set-null, `referral_count` counter),
  `early_access_code` (code unique, optional email/entry bind,
  created_by/redeemed_by → user set-null, expires_at), `referral`
  (append-only attribution; `kind` waitlist|signup; unique
  `(kind, referred_user_id)`/`(kind, referred_email)` for idempotent
  counting). Platform-level marketing assets — intentionally NO
  `workspace_id`, unlike feature_request/CMS/commerce.
- 2026-09-22 — Added feature-board tables: `feature_request`
  (workspace-scoped member feedback; `status` free-flows through
  open/under_review/planned/in_progress/shipped/closed; `vote_count`
  is a denormalized counter updated in the same transaction as vote
  writes; `created_by` set-null) + `feature_request_vote`
  (composite PK `(request_id, user_id)` is the one-vote-per-member
  dedupe; carries `workspace_id` for scoped queries). New audit
  actions `feature_request.*` and webhook events
  `feature_request.created` / `feature_request.status_changed`.
- 2026-09-22 — Added CMS + commerce tables: `content_entry`
  (workspace-scoped post/page/doc, draft/published/archived,
  `uq_content_entry_workspace_slug`), `commerce_product`
  (draft/active/archived, `price_cents`, nullable `inventory`),
  `commerce_order` + `commerce_order_item` (denormalized
  `product_name`/`unit_price_cents` keep order history stable when
  products change). New audit actions `content_entry.*` /
  `commerce_product.*` / `commerce_order.*`.
- Idle — issue #2 fixed 2026-09-22 (`issuer` column + `idx_account_issuer_account` + migration `0001_far_luke_cage`).

## Agent Decisions / Thoughts

- **2026-09-22:** `issuer` backfill follows BA conventions — `createLocalAccountIssuer` → `local:<providerId>` for `credential`; `createOAuthAccountIssuer` → `local:oauth:<providerId>` for all built-in social providers (none declare `accountIssuer`, verified in `dist/social-providers`). generic-oauth is not enabled in this kit.
- **2026-09-22:** Orphan `user` rows (user w/o account from failed sign-ups) are NOT deleted by the migration — magic-link sign-in legitimately creates users with zero account rows (`plugins/magic-link` does `createUser` + `createSession`, never `createAccount`), so "no accounts" is not a safe orphan signal.

## Important Notes / NEVER Change

- Every user-owned record stays `workspaceId`-scoped (AGENTS.md).
- Never drop Better Auth's expected fields/indexes when squashing migrations — the adapter validates the schema object, so missing fields 500 at runtime even when the DB has the column (this exact drift caused issue #2).

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-09-22 | +`workspace_domain` custom-domain records (migration 0005) | Devin |
| 2026-09-22 | Registration 500: `field "issuer" does not exist in the "account" Drizzle schema` | 6c5d85a migration squash dropped `issuer` from schema + baseline while some DBs kept the column | Added `issuer` + `idx_account_issuer_account`; new idempotent migration 0001 with backfill |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-16 | +`push_ticket` (id text PK = Expo ticket id, `token` text NOT NULL, nullable `user_id` text FK → `user.id` cascade, `created_at` + `idx_push_ticket_created_at`) — recorded send tickets awaiting receipt reconciliation — migration 0020 | Devin |
| 2026-10-16 | +`workspace_usage_cap` (PK `(workspace_id, key)`, `workspace_id` text FK → `workspace.id` cascade, `key` varchar(100), `cap` integer NOT NULL CHECK `cap >= 0`, created/updated helpers) — owner/admin-set hard ceilings layered over plan `usageLimits`; WORKSPACE-scoped, persists across months unlike `usage_counter` — migration 0019 | Devin |
| 2026-10-15 | +`user_appearance` (`user_id` text PK → `user.id` cascade, `preferences` jsonb NOT NULL, created/updated helpers) — per-user synced appearance snapshot for cross-device theme sync; USER-scoped (follows the account), not workspace-scoped — migration 0018 | Devin |
| 2026-10-12 | `credit_transaction`: +`uq_credit_transaction_reference` partial unique on `(workspace_id, kind, reference_id)` where `reference_id IS NOT NULL` — raced reference-bearing writes conflict instead of double-applying; `credit_balance`: +`credit_balance_nonnegative` CHECK — migration 0016 | Devin |
| 2026-10-10 | +`credit_balance` + `credit_transaction` (prepaid workspace credit pool, append-only signed ledger with `balance_after`), +`device_push_token` (workspace+user-scoped Expo push tokens, unique `token`), +`analytics_event` (nullable-workspace self-hosted analytics rows; `visitor_hash` daily-rotating, no raw IP) — migration 0015 | Devin |
| 2026-10-03 | `waitlist_entry`: add `idx_waitlist_entry_created_at` for bounded FIFO rank counts (migration 0014) | Codex |
| 2026-10-02 | `job_schedule`: +`missed_runs` integer DEFAULT 0 NOT NULL (migration 0013) — cumulative cron occurrences that elapsed unclaimed; claim-time delta written by `claimDueSchedules`, upserts never touch it | Devin |
| 2026-09-27 | `content_entry`: +`required_entitlement` varchar(100) nullable (migration 0012) — minimum subscription tier to read the body; NULL = free for every reader | Devin |
| 2026-09-27 | `feat/prod-ready-kit` merged into main: +`connected_account` (0008), +`usage_counter` (0009), `job_schedule.workspace_id` nullable + partial unique `idx_job_schedule_workspace_type` + `idx_job_schedule_next_run_at` (0010–0011) | Devin |
| 2026-09-23 | +`rate_limit_bucket` shared fixed-window limiter table (migration 0006, Task 4); +`platform_ai_spend` daily UTC public-AI spend ledger (migration 0007, Task 6) — both on `feat/prod-ready-kit` | Devin |
| 2026-09-22 | +`waitlist_entry`, `early_access_code`, `referral` growth tables (migration 0004) | Devin |
| 2026-09-22 | +`feature_request`, `feature_request_vote` for the workspace feedback board | Devin |
| 2026-09-22 | +`content_entry`, `commerce_product`, `commerce_order`, `commerce_order_item`; audit actions for CMS/commerce | Devin |
| 2026-09-22 | account: +`issuer`, unique index → `(issuer, account_id)` (issue #2) | Devin |
