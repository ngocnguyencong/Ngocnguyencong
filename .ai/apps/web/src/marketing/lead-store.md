# apps/web/src/marketing/lead-store.ts

> Last updated: 2026-09-21 | Protection: STANDARD

## Purpose

Persistence boundary for marketing leads (contact form + newsletter).
`getLeadStore()` returns a `LeadStore` selected by env, or `undefined`
when `MARKETING_LEAD_STORE` is unset (lead capture stays email-only —
the historical behavior). Implementations:

- `local` — JSON file (`.data/marketing-leads.json`, override with
  `MARKETING_LEAD_STORE_PATH`). Dev placeholder: real writes to gitignored
  dev state, NOT production storage.
- `firestore` — `firebase-admin` dynamic-imported only when selected;
  collection `marketing_leads`. Newsletter doc id `newsletter:{email}`
  via `create()` so re-submits map gRPC code 6 / HTTP 409 → `"duplicate"`;
  contact leads use auto-id `add()` (repeat messages are legitimate).

## Important Notes

- Env contract: `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (literal `\n` escapes
  normalized), `FIRESTORE_DATABASE` (default `(default)`). Secrets stay
  server-only — module starts with `import "server-only"`.
- Types (`LeadRecord`, `LeadStore`) live in `marketing-leads.ts` so this
  server-only module never leaks into client bundles through a shared
  import; this file only implements the interface.
- Dedupe rule is kind-aware: newsletter dedupes by email, contact never
  dedupes (each message stored separately).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-21 | Initial implementation (local JSON + Firestore impls) for marketing leads | Devin |
