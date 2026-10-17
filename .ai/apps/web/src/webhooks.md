# apps/web/src/webhooks.ts

> Last updated: 2026-09-29 | Protection: STANDARD

## Purpose

Outbound-webhook shared helpers: endpoint URL validation, payload signing,
payload builder, retry backoff. Pure module — safe to import from server
actions and the delivery worker alike.

## What It Does

- `isValidWebhookEndpointUrl(value, production)` — http(s) only, no
  embedded credentials; production additionally requires https AND a
  publicly routable host.
- `isPubliclyRoutableHost(hostname)` — the SSRF guard shared by
  registration and the delivery-time DNS re-check. Accepts a WHATWG URL
  hostname (IPv6 keeps its brackets) or a bare `dns.lookup` address.
- `stripIpv6Brackets(host)` — shared bracket normalization; the delivery
  worker uses it because `dns.lookup` rejects bracketed v6 literals.
- `signWebhookPayload` — Stripe-style `t=<unix>,v1=<hmac-sha256>`.
- `buildWebhookPayload` — `{id, type, workspaceId, createdAt, data}` plus
  optional top-level `correlationId` meta (the emit chain's `corr_<uuid>`,
  omitted when absent). `nextWebhookRetryAt` — backoff 60s/5m/30m/30m,
  max 5 attempts (null → permanently failed).

## Important Notes

- `isPubliclyRoutableHost` rejects: IPv4 private/loopback/link-local
  (incl. metadata `169.254.169.254`)/CGNAT/doc/multicast/reserved ranges;
  inet_aton-style shorthand (`127.1`, `2130706433`, octal/hex parts);
  IPv6 `::`/`::1`, fe80::/10, fc00::/7, ff00::/8, 2001:db8::/32,
  64:ff9b::/96 + 64:ff9b:1::/48 (NAT64 well-known + RFC 8215 local-use),
  2001::/32 (Teredo) and 2002::/16 (6to4) — tunnel prefixes embed a v4
  the v4 rules can't see; v4-mapped/embedded v6 (`::/96`, `::ffff:/96`)
  re-checks the embedded 32 bits against the IPv4 rules; deprecated
  v4-translated `::ffff:0:0/96` is rejected outright; hostnames reject
  single-label names and `.corp`/`.home`/`.home.arpa`/`.internal`/`.lan`/
  `.local`/`.localhost` suffixes (the `.internal` rule covers
  `metadata.google.internal`).
- FQDN trailing dots and bracketed IPv6 are normalized before parsing;
  unparseable literals fail closed.
- Non-production keeps permissive behavior — localhost/private http
  receivers stay valid for local dev.

## Bug Fixes

| Date | Bug | Cause | Fix |
| --- | --- | --- | --- |
| 2026-09-27 | SSRF: `https://169.254.169.254/`, `https://10.x/`, `https://[::1]/`, `https://metadata.internal/` registered in production and received signed workspace payloads | `isValidWebhookEndpointUrl` checked only scheme + embedded credentials | Production validation now requires `isPubliclyRoutableHost(url.hostname)` |
| 2026-09-27 | `::ffff:0:7f00:1` (v4-translated) passed the guard — a private embed in `::ffff:0:0/96` fell through to public | Only `::/96` and `::ffff:/96` embedded forms were re-checked; the translated prefix was missed | `isPublicIpv6` rejects `zeros(0,8) && bytes[8..9]==ff ff && zeros(10,12)` outright |
| 2026-09-27 | `parseIpv4` accepted junk like `0abc` as byte 0 | decimal branch regex `/^0\|[1-9][0-9]*$/` matched any leading-0 string | Anchored alternation `/^(?:0\|[1-9][0-9]*)$/` |

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-29 | `WebhookPayload`/`buildWebhookPayload` += optional `correlationId` — emit-chain id lands in `webhook_delivery.payload` and the subscriber POST body | Devin |
| 2026-09-27 | `isPublicIpv6` += 64:ff9b:1::/48 (RFC 8215 NAT64 local-use), 2002::/16 (6to4), 2001::/32 (Teredo) — tunnel/embedding prefixes | Devin |
| 2026-09-27 | +`stripIpv6Brackets` export; reject v4-translated `::ffff:0:0/96`; fixed `parseIpv4` decimal-part regex | Devin |
| 2026-09-27 | Added `isPubliclyRoutableHost` + production public-host requirement (webhook SSRF hardening) | Devin |
