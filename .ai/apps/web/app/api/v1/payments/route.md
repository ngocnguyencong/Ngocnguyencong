# apps/web/app/api/v1/payments/route.ts

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

GET lists payments; POST records one — the record runs through supadata/payments.recordPayment so channel/source/campaign attribution + MRR fields are computed at write time.

## Important Notes / NEVER Change

- Always create payments via recordPayment, never a bare insert — attribution would be skipped.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
