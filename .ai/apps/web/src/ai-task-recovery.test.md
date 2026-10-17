# apps/web/src/ai-task-recovery.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Unit tests for `taskRecoveryHref`: both params, each param alone, absent
(`null`), array values dropped, caller-supplied localized `consolePath`, and
query encoding. Route-level redirect coverage lives in
`src/locale-app-routes.test.ts`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-13 | += empty-string passthrough + `firstSearchParam` cases | Devin |
| 2026-10-13 | Added with the `ai-task-recovery` helper extraction | Devin |
