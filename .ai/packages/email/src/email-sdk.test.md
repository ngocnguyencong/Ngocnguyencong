# packages/email/src/email-sdk.test.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

Offline tests for `EmailSdkTransactionalEmailSender` via the email SDK's
memory/capture adapter — asserts messages pass through unchanged, each
provider kind is constructed, and telemetry stays disabled. No network.
Also checks status metadata omits message payloads and expires/evicts old
entries under the shared sender retention policy.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Add bounded status-retention regressions | Codex |
| 2026-09-22 | Initial tests (phase B2) | Devin |
