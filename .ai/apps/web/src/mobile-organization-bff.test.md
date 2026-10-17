# src/mobile-organization-bff.test.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose（一句话人话）

组织 BFF 决策层的确定性单测 —— 注入内存 deps 验证认证门限、角色门限、
输入校验和 reason→status 映射。

## What It Covers

- 三个 normalizer（org 名、邀请角色、指派角色）。
- listMembers 401/404/200 路径。
- invite：manager 门限、422 校验、409 冲突映射、默认 role=member + 201。
- resend/revoke：missing→404、not-pending→422。
- acceptInvite：无 session 401、email 回退到 getSessionEmail、
  四种 reason 的状态映射。
- updateRole/removeMember/leave 的 reason 映射（soleOwner/selfRemoval…）。
- create/rename/delete 的认证/owner 门限与确认串校验。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
