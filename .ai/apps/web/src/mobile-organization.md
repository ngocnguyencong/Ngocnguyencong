# src/mobile-organization.ts

> Last updated: 2026-10-04 | Protection: CRITICAL

## Purpose（一句话人话）

`mobile-organization-bff` 的真实接线 —— 把 `organization-actions` 的每个
FormData/redirect server action 复刻成带 JSON 结果的 dep 实现（相同的查询、
相同的 evaluate* 判定、相同的审计 + 产品通知 + webhook 扇出）。

## What It Does

- `mobileOrganizationBff` 单例供路由层调用。
- `setWorkspacePreference` —— accept-invite/create-org/leave 后持久化
  `userWorkspacePreference`，让不带 cookie 的 mobile 客户端下次解析到
  正确工作区（leave 之后回退到剩余 membership）。
- `sendInviteEmail` —— 与 web 相同的 `buildWorkspaceInviteEmail` +
  locale 解析 + transactional sender。
- `countOwners` —— 与 actions 相同的 owner 计数喂给 evaluate* 决策。

## Important Notes

- 与 `organization-actions.ts` 保持一一对应：修改 org 语义时两边要同步；
  seat limit 复用 `getWorkspaceSeatLimit`（billing 价格引用 → 席位上限）。
- 邀请创建、接受与过期邀请续期使用同一个 workspace-scoped transaction
  advisory lock；成员数、有效 pending 邀请数与对应状态写入必须留在同一
  事务里。接受邀请要消费已有 reservation，并拒绝已超过 plan seat 上限的
  legacy workspace。
- `updateRole`、`removeMember` 和 `leaveOrganization` 也在同一个
  workspace advisory transaction 里完成 actor/target membership 查询、owner
  数量查询、策略判定和写入。它们与邀请占位/接受串行化，避免并发操作绕过
  最后一位 owner 的降级、移除或离开限制。
- Invite token：`randomBytes(24).toString("base64url")` + 7 天过期，resend
  时对过期 invite 轮换 token，与 web 一致。

## Dependencies

- `database`/`getAuthSession`（auth-runtime）、`recordAuditEvent`、
  `tryEmitProductNotification`、`tryEmitWorkspaceEvent`、
  `resolveMobileWorkspaceContext`、`@supastack/db` schema + helpers。

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Role change, member removal, and organization leave share the serialized workspace-seat transaction and owner checks | Codex |
| 2026-09-28 | Created — mobile runtime wiring for the organization BFF | Devin |
