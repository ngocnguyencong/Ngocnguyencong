# src/workspace-switcher.test.ts

> Last updated: 2026-09-24 | Protection: STANDARD

## Purpose

Source-contract coverage for workspace switching and account-menu placement.

## Open Threads / Resume Context

Empty — placement and reduced-content assertions pass.

## Important Notes / NEVER Change

- These are focused static contracts; browser verification owns rendered
  disclosure behavior.

2026-10-06: Shared ShellNavigation owns the aside, so account placement is checked within its sidebar slot. Sign-out copy comes from the locale dictionary; preserve the email/sign-out-only contract and shared Popover usage.
