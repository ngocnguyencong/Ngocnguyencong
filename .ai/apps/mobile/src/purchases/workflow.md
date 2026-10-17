# src/purchases/workflow.ts

> Last updated: 2026-10-01 | Protection: STANDARD

## Purpose

Synchronizes a completed store operation with the server and refreshes the
server-owned entitlement for the expected workspace.

## Important Notes / NEVER Change

- Never accept RevenueCat customer info or client entitlement IDs as proof.
- A workspace mismatch must fail before refreshing UI entitlement state.
- An inactive server sync always returns no entitlement even if store data claims one.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-01 | Sync before refreshing and displaying entitlement | Codex |
