# github-connection-card.tsx

> Last updated: 2026-09-23 | Protection: STANDARD

## Purpose

Generic production-dashboard card for linking Better Auth to GitHub and showing the public linked profile. It contains no order/license fulfillment logic.

## Security Invariants

- Calls Better Auth `linkSocial`; OAuth tokens never reach the component.
- Auth.js and unconfigured OAuth are explicit non-interactive states.
- No unlink action is exposed by default.
