# src/server.test.ts

> Last updated: 2026-10-04 | Protection: STANDARD

## Purpose（一句话人话）

`server.ts` 组合测试 —— 注入工厂断言 adapter/hooks/plugin 回调；
early-access gate 的放行/拦截矩阵（无码拒绝、有效码放行、四种无效状态、
admin method/ADMIN_EMAILS/email-OTP sign-in 无邀请码放行、invite-only 关闭允许创建）；
`after` 钩子把净化后的 cookie 值转给 `onCreated`。

## Coverage

- Adapter-boundary regressions assert passkey/two-factor cleanup and the
  injected Supastack API-key revoker run before the user update; cleanup failure
  prevents promotion, verified owners are preserved, and wrapped transaction
  callbacks retain their options and arguments.
- Session-create hook cases reject missing, unverified, or banned passkey
  owners and missing/foreign persisted credentials; an active owner's exact
  credential remains valid. API-key session admission is covered separately by
  the app session projection tests.
- Additional hook cases check the persisted owner before TOTP state updates,
  require the active session/current factor before a TOTP replacement session,
  and deny `/link-social` account creation from a revoked or inactive session.
  Verified active linking and ordinary provider callback account creation
  remain allowed.

- The OAuth ownership validator stays installed when invite-only is off;
  only the invitation requirement is disabled. Check the permitted creation
  result rather than requiring the entire validation hook to be absent.
  Invitation bypass fixtures use email-OTP sign-in; an OAuth sign-in must still
  satisfy the separate persisted verified-identity requirement.

- Auth composition fixtures supply the required mail-admission allow stub.
  The suite also verifies first-password creation needs a one-use proof bound
  to the verified user session and rejects proof replay.
- These are deterministic memory-adapter/composition tests; no live
  PostgreSQL, Firestore, OAuth provider, mail provider, or WebAuthn hardware is
  exercised.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-04 | Cover recovery-time TOTP/session and social-link adapter guards | Codex |
| 2026-09-22 | +early-access gate/redemption 6 测试 | Devin |
