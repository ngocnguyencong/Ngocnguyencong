# app/feedback.tsx

> Last updated: 2026-09-28 | Protection: STANDARD

## Purpose

Feature board: list/filter feature requests, vote/unvote, submit new
requests — backed by `/api/mobile/feature-requests` BFF. Renders under
the root `Stack` (linked from Home quick actions and Settings); keeps
its own auth client for standalone use.

2026-10-06: Adapt the legacy static feature-board colors to the active shared native palette. Status badges and errors use semantic status roles; fields use required-control borders. Keep native controls and authentication/data behavior intact. Give chips/votes a 44px target and visible pressed state. Device rendering remains unverified.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-09-28 | Dropped unnecessary auth-client type assertion | Devin |
| 2026-09-22 | Created | Devin |

Use the palette-backed AppButton for submission; pressed chips/votes keep their full foreground contrast.
