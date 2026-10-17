# apps/web/src/ses-sdk.test.ts

## Purpose

Offline regressions for the AWS SES SDK transport boundary, with server-only credentials and workspace-scoped transactional delivery.

## 2026-10-04 — AWS SES

Five official-SDK boundary cases send a transaction using default, explicit, and temporary credentials; verify command mapping and workspace-scoped delivery status; and cover default/temporary credentials in the separate operator sender. No AWS network requests are made.
