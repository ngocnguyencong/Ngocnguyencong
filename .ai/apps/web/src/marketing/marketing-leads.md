# apps/web/src/marketing/marketing-leads.ts

> Last updated: 2026-09-21 | Protection: STANDARD

## Purpose

Pure parsing + submit logic for marketing leads (contact + newsletter).
No Node/IO imports — safe to import from client components (status copy,
form helpers). `submitLead` delivers a parsed lead to the configured
sinks: optional `LeadStore` persistence (see `lead-store.ts`) plus the
optional `MARKETING_INBOX` notification email.

## Important Notes

- `submitLead` returns `delivery-not-connected` only when NEITHER a
  store nor a working inbox is configured — a configured store alone
  makes lead capture fully functional.
- Persist happens before notify: a `LeadStore.save` `"duplicate"`
  short-circuits to `{ ok: true }` (repeat newsletter signups are
  already captured; no second inbox mail). Store/send failures
  propagate — same failure style as the existing `send` path.
- `LeadRecord`/`LeadStore`/`LeadSaveResult` types are declared HERE
  (not in `lead-store.ts`) so the interface stays in a client-safe
  module; the server-only impl imports the types.
- Never invent subscriber counts — tests assert no `subscriber|count`
  strings in payloads/messages.
- `LeadError` includes `"captcha"` (Turnstile gate in `leads-actions.ts`);
  `leadStatusMessage` maps it to "Complete the human check and try again."

## Change History


| Date | Change | Author |
| --- | --- | --- |
| 2026-09-22 | `"captcha"` lead error + status copy | Devin |
| 2026-09-21 | Added optional `store` sink (LeadStore) + `LeadRecord` type; gate now accepts store-only configs | Devin |

## Security Fix (2026-09-27)

The rate-limited form status gives visitors a retry-later message and is an accepted status in the redirect parser.
