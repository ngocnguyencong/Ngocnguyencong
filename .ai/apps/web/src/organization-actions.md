# apps/web/src/organization-actions.ts

> Last updated: 2026-10-11 | Protection: CRITICAL

## Purpose

Server actions for organization/workspace management: member invites
(create + resend), role changes, removal, rename/delete, audit events.

## Important Notes

- Exported lookup helpers are server actions too.
  `resolveActiveWorkspaceIdForUser` must accept only the current session's user;
  `getWorkspaceSeatLimit` must verify membership before reading billing rows.
  Preserve existing authorized cookie/preference resolution and plan results.
  The cookie → preference half of that resolution is also exported as
  `resolveActiveWorkspaceIdForSessionUser` for callers that already hold a
  session-verified `userId` (the `/api/mobile/*` workspace context) — it
  performs no auth check itself, so membership verification stays the
  caller's job.
- Invite mail flows: request locale resolves from
  `x-supastack-locale` header → `accept-language`;
  `buildWorkspaceInviteEmail` returns `{subject, text, lang, footer}`;
  all four pass into `inviteMail.send` — the HTML shell now localizes
  with the request locale.
- `recordAuditEvent` follows every mutation — keep action/target
  pairing intact when editing flows.
- `uploadOrganizationLogoAction` shares the authenticated logo admission and
  stable workspace image replacement lifecycle used by the API route. It must
  continue to require an owner/admin membership scoped to `(userId, workspaceId)`
  before reading image bytes or writing storage.
- Invite creation, acceptance, revocation, and expired-invite renewal use the
  shared workspace-seat transaction lock. Keep live member/pending counts and
  the corresponding reservation or acceptance update inside that transaction;
  acceptance consumes its own pending reservation and rejects over-limit legacy
  workspaces.
- Role changes, member removal, and leaving an organization use that same
  workspace-scoped advisory transaction. Read the actor and target membership,
  current owner count, and policy decision under the lock, then apply the role
  or membership write before the transaction commits. This serializes owner
  demotion/removal/leave with other seat changes, so concurrent actions cannot
  bypass the last-owner rule.
- Invite rejection reasons are interpolated into the settings status URL; tests
  should pin the typed reasons and displayed outcomes instead of requiring a
  literal `status=...` fragment in this server action.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Split `resolveActiveWorkspaceIdForSessionUser` (cookie → preference, no session re-resolve) out of `resolveActiveWorkspaceIdForUser` for the membership-verified mobile context | Devin |
| 2026-09-22 | Invite sends forward `lang` + `footer` | Devin |
| 2026-10-03 | Logo action checks upload quotas and uses serialized stable-key replacement with bounded legacy cleanup | Codex |
| 2026-10-03 | Lookup actions verify session identity or workspace membership before preference/billing reads | Codex |
| 2026-10-03 | Invite quota reads and reservation/acceptance transitions share the workspace advisory transaction | Codex |
| 2026-10-04 | Serialize role changes, member removal, and organization leave with workspace seat operations and owner-count checks | Codex |
