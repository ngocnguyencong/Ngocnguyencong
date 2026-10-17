# apps/web/src/webhooks.test.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Unit coverage for `webhooks.ts` — URL validation, the SSRF host guard,
signing, payload building, retry backoff.

## Coverage

- `WEBHOOK_EVENTS` catalog presence (incl. `ping`).
- `isValidWebhookEndpointUrl` — https-only in production, no credentials;
  production rejects private/link-local IPv4, mapped/embedded v6,
  intranet suffixes, and single-label hosts; accepts public https
  (hostname and `8.8.8.8` literal); non-production keeps http localhost/
  private targets.
- `isPubliclyRoutableHost` — table-driven rejects (each RFC1918/link-
  local/CGNAT/doc/multicast/reserved range, v6 `::`/`::1`/fe80/fc–fd/ff,
  2001:db8, `::ffff:` mapped + hex form, `::` v4-compatible private,
  v4-translated `::ffff:0:x` (hex + dotted forms), `64:ff9b::/96` +
  `64:ff9b:1::/48` NAT64 (incl. embedded-private-v4 form), `2002::/16`
  6to4, `2001::/32` Teredo,
  malformed v6 (`:::`, `1::2::3` fail closed), localhost/`*.internal`/
  `*.local`/`*.lan`/`*.corp`/`*.home`/`*.home.arpa`/
  `metadata.google.internal`, single labels, trailing-dot FQDN,
  inet_aton shorthand `127.1`/`2130706433`, bracketed v6) and allows
  (public v4 edges like `100.63.x`/`172.15/32.x`,
  `*.internal.example.com`, public v6, mapped-public v4).
- `signWebhookPayload` — deterministic `t,v1` HMAC shape.
- `buildWebhookPayload` — envelope field mapping, incl. the optional
  `correlationId` top-level payload meta.
- `nextWebhookRetryAt` — 60s/5m/30m/30m backoff, null at attempt 5.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `buildWebhookPayload` += `correlationId` meta case | Devin |
| 2026-09-27 | +NAT64 local-use (`64:ff9b:1::/48`, incl. embedded-private-v4 `…::a9fe:a9fe`), 6to4 (`2002::/16`), Teredo (`2001::/32`) rejects | Devin |
| 2026-09-27 | +v4-translated rejects (hex + dotted), malformed-v6 fail-closed cases | Devin |
| 2026-09-27 | Added production SSRF rejection table + full `isPubliclyRoutableHost` matrix | Devin |
