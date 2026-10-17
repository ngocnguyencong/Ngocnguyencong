# src/organization/client.ts

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

`/api/mobile/{organization,members,invitations}` client — the
`{data}`-enveloped BFF surface for members, invites, and the organization
lifecycle.

## What It Does

- `listMembers()` → `OrganizationMembersPayload` (members,
  pendingInvitations, seatCount/Limit, canManage/canLeave, currentRole).
- Mutations: `invite`, `resendInvite`, `revokeInvite`, `acceptInvite`
  (→ workspaceId), `updateRole`, `removeMember`, `leave`,
  `createOrganization` (→ workspaceId), `renameOrganization`,
  `deleteOrganization(confirm)` — confirm must equal the org name.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Created | Devin |
