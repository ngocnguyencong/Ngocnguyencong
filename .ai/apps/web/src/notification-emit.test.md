# apps/web/src/notification-emit.test.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose

Unit tests for `emitWorkspaceProductNotification` with fake deps.

## What It Does

- In-app rows only for members whose `inAppProduct` preference allows;
  zero inserts for an empty workspace.
- Email fan-out respects `shouldDeliverEmailNotification` categories and
  survives a throwing sender.
- Push fan-out reaches only members who got an in-app row, forwards
  `data: {href}`, and survives a throwing `sendPush`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-10 | `sendPush` coverage — recipient scoping + failure tolerance | Devin |
