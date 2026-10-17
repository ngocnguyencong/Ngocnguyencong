# src/mobile-organization-bff.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose（一句话人话）

`/api/mobile/{organization,members,invitations}` 的框架无关边界 ——
成员/邀请/组织生命周期的全部决策（校验、角色门限、错误映射）依赖注入，
与 `mobile-feature-board-bff` 同一模式，离开 Next 也能确定性测试。

## What It Does

- `createMobileOrganizationBff(deps)` → `{ listMembers, invite, resendInvite,
  revokeInvite, acceptInvite, updateRole, removeMember, leave,
  createOrganization, renameOrganization, deleteOrganization }`
- 统一 `{data}` | `{error:{code,message}}` 信封；reason → status 映射
  （already-member/seat-limit→409、not-pending→422、missing→404、
  email-mismatch→403 等）。
- `resolveManagerContext` 内联 owner/admin 门限；rename/delete 再收窄到 owner。
- 纯校验器 `normalizeMobileOrganizationName` / `normalizeMobileInviteRole`
  （admin|member|guest，owner 不可被邀请）/ `normalizeMobileAssignableRole`。

## Important Notes

- 决策的真值在 `@supastack/db` 的 evaluate* 助手中，由 runtime
  （`mobile-organization.ts`）执行；BFF 只负责校验 + 映射，不碰 DB。

## Dependencies

- 依赖接口 `MobileOrganizationDependencies`；runtime 注入 session +
  workspace 解析 + DB/邮件/审计/webhook 实现。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created — full organization/member/invite surface for mobile | Devin |
