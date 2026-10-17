# src/growth/waitlist-service.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`waitlist-service.ts` 单测 —— fake store 覆盖：join 建号+排位、`?ref=`
归因+计数、自推荐跳过、duplicate generic outcome hides rank/code、批量邀请的 referral 排序、
邮件失败隔离（码与 invited 状态保留）。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-03 | Duplicate outcome hides existing entry details | Codex |
| 2026-09-22 | 初版 | Devin |
