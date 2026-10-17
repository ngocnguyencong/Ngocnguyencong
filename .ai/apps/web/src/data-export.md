# src/data-export.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose（一句话人话）

GDPR 式个人数据导出 `buildUserDataExport(userId)` —— 聚合该用户所有
workspace 内产物；secrets（session token、key hash、webhook secret、BYOK）
永不导出。

## What It Does

- 返回 frozen 对象：profile/sessions/accounts/memberships/invitations/
  notifications/preferences/apiKeys/audit events/chat/uploads/
  `authoredContentEntries`/`authoredFeatureRequests`/`featureVotes`/
  `growth`（waitlistEntries + referrals + earlyAccessCodes，按 user 邮箱
  与 userId 键）。
- `format: "supastack-gdpr-export@1"` 版本标记。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-27 | feat/prod-ready-kit merge: +`connectedAccounts` — non-secret columns only (no `token_*`), external ids masked like the settings UI, rows scoped to member workspaces | Devin |
| 2026-09-22 | +`growth` 段（waitlist/referral/early-access，平台级记录按 email+userId 键） | Devin |
| 2026-09-22 | +`authoredFeatureRequests` + `featureVotes`（board 数据入导出） | Devin |
