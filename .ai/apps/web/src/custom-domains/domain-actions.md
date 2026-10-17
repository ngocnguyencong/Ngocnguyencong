# apps/web/src/custom-domains/domain-actions.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`"use server"` domain actions: `listWorkspaceDomains`,
`addWorkspaceDomain`, `refreshWorkspaceDomain`, `removeWorkspaceDomain`.
All go through `requireWorkspaceManager` (owner/admin), scope rows by
`workspaceId`, validate hostnames via `hostname.ts`, emit audit events
(`workspace_domain.added|verified|removed`), and fire the
`domain.verified` webhook on pending → active transitions. Removal
deletes at the provider first, then the row. When
`CUSTOM_DOMAINS_PROVIDER=off` the list action returns
`{ enabled: false }` and mutations refuse.

Domain creation holds a transaction-scoped advisory lock for its workspace
through the quota check, provider creation and insert. This prevents parallel
distinct hostnames from exceeding five slots. Failed persistence removes the
new provider record where possible. Actual PostgreSQL concurrency remains
integration-gated; the focused regression uses a serialized repository.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | Initial actions (phase B3) | Devin |
