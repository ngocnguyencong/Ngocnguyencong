# packages/email/src/email-sdk.ts

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`EmailSdkTransactionalEmailSender` — the existing `EmailSender` contract
implemented over `@opencoredev/email-sdk`'s `createEmailClient({
adapters, telemetry: false })`. Routes `EMAIL_PROVIDER` =
postmark|sendgrid|mailgun|smtp|brevo through the SDK's adapter subpaths.
Telemetry is disabled in every construction path (the SDK also honors
`EMAIL_SDK_TELEMETRY=0` / `DO_NOT_TRACK=1` env opt-outs).
Successful deliveries retain only TTL- and count-bounded status metadata;
recipient and message content are returned from `send` but not kept in the
sender's status map.

## Dependencies

- Composition: `apps/web/src/server-provider-composition.ts`
  (`createEmailSdkClient` factory injectable for tests).
- Envs: `POSTMARK_SERVER_TOKEN`, `SENDGRID_API_KEY`,
  `MAILGUN_API_KEY`+`MAILGUN_DOMAIN`(+`MAILGUN_REGION`),
  `SMTP_HOST/PORT/USER/PASSWORD/SECURE`, `BREVO_API_KEY`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-03 | Bound email-sdk status retention and store metadata only | Codex |
| 2026-09-22 | Initial sender (phase B2) | Devin |
