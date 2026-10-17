# apps/web/src/supadata/channels.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Source/medium → channel classification computed once at ingest and denormalized onto event/session/payment rows: utm medium buckets (paid/email/social/organic/ai/referral/campaign), click ids (gclid→paid_search, others→paid_social), referrer hosts (ai/search/social/video/shopping/referral), else direct.

## Important Notes / NEVER Change

- Self-referrals are ignored (host == own hostname or subdomain).
- source uses utmSource > friendly referrer name > (direct); medium utmMedium > referral > (none).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
