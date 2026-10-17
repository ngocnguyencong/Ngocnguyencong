# src/purchases/client.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Typed, validated client for the authenticated mobile RevenueCat availability and server-sync endpoint.

## Important Notes / NEVER Change

- Never send client-supplied subscriber IDs or entitlement claims to the server.
- The active workspace is derived by the server from the authenticated session.
- GET validates availability, server app user ID, entitlement ID, and workspace ID; unavailable status requires null IDs.
- POST sends `{}` and accepts only the server's `active` and `workspaceId` result.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Validate server status and empty-body sync results | Codex |
