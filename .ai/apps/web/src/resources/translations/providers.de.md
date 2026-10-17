# providers.de.json

## Purpose

German translations keyed by the exact English source strings used in `provider-guides.ts`.

## Completed Content

- All 142 unique human-facing source strings currently used by the 23 provider guides have German values.
- The dictionary retains one older, unused source key from the previous shared transactional-email description; this does not affect current guide coverage.
- New copy covers beginner setup, `.env.local`, server-only secrets, local demo versus database-backed flows, environment/callback/webhook separation, restart steps, provider dashboard links, testing, troubleshooting, and production.
- Inline code and technical identifiers such as environment keys, paths, routes, and commands are preserved. The shared English source still owns code blocks, slugs, section IDs, and hrefs.

## Important Notes

- These exact-source-key values feed the docs localization layer; rendering and layout belong to the docs UI owner.
- Update this map whenever a human-facing English string in `provider-guides.ts` changes.

## Change History

- 2026-10-01 — Added the original 89 provider-guide translations.
- 2026-10-02 — Added natural German translations for every new human-facing string in the 23-guide beginner pass; checked full source-key coverage.

## Open Threads

- **Status:** none
- **Intent:** Keep German coverage complete for the current provider-guide source.
- **Next steps:** None for this content slice.
- **Blockers / notes:** No code examples, slugs, section IDs, or URLs are translated in this dictionary.

## 2026-10-04 — AWS SES

AWS SES setup guidance covers verified identity/region/sandbox, classic IAM SMTP creation/management links, separate API keys or roles/session tokens, SMTP STARTTLS, all-platform server-only configuration, and current Mail Manager pricing. The optional open/mTLS endpoint fee is $50/month; authenticated endpoints are currently complimentary. Guide links, localized overlays and environment inventories stay aligned.

2026-10-13: rekeyed route-reference entries whose English sources now point to `/ai` — the provider test/sandbox dashboard guidance and the `/ai`-only no-database reference-screen note; values retranslated to match.
