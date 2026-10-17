# src/growth/early-access.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`early-access.ts` 单测 —— 内存 fake `GrowthStore` 覆盖码状态映射、
有效码核销+绑定 entry joined、无码按邮箱 joined、无效码不核销、
signup referral 归因、自推荐/未知码跳过。

## Coverage

- Concurrent attempts with two normalized emails bind an unbound invite to
  exactly one email; the other receives `email-mismatch`, and binding does not
  redeem the code.
- If user creation fails before post-create redemption, the same email can
  retry and another email cannot take the bound code.
- The existing fake-store cases continue to cover status mapping, redemption
  and waitlist joining, signup referral attribution, and self/unknown-referral
  skips. Drizzle predicate shape is covered separately in `growth-store.test.ts`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Cover first-use mailbox binding, competing emails, and same-email retry | Codex |
| 2026-09-22 | 初版 | Devin |
