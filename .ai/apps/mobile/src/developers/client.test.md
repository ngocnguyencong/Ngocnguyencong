# src/developers/client.test.ts

> Last updated: 2026-10-13 | Protection: STANDARD

## Purpose

Vitest coverage for `createMobileDeveloperActions`: flat-payload
unwrapping, malformed-row filtering, one-time-secret propagation, and
route/method wiring. `makeApi` captures the serialized request body so
`schedules.upsert` can assert the `enabled` flag round-trips and
`apiKeys.create` can assert `expiresInDays` forwards; sibling describes
cover `scheduleToggleInput` pause/resume input shape,
`webhooks.deliveries` route wiring + row filtering,
`formatDeliveryMeta` attempt/response-code formatting,
`parseApiKeyExpiryDays` clamp/parse behavior, and `formatApiKeyMeta`
date-joined meta line.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-13 | += `expiresInDays` forwarding + `parseApiKeyExpiryDays`/`formatApiKeyMeta` coverage | Devin |
| 2026-10-13 | += `webhooks.deliveries` + `formatDeliveryMeta` coverage | Devin |
| 2026-10-13 | += schedule toggle coverage (body capture + `scheduleToggleInput`) | Devin |
| 2026-09-28 | Created | Devin |
