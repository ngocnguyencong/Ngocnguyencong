# seat-count.ts

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Pure helpers behind editable seat-quantity inputs (stepper + type-to-edit).

## Public API

| Export              | Type                                  | Description                                   |
| ------------------- | ------------------------------------- | --------------------------------------------- |
| `sanitizeSeatInput` | `(raw: string) => string`             | Strips non-digit chars from a seat draft      |
| `parseSeatInput`    | `(draft: string) => number \| null`   | Digits-only draft → integer ≥ 1, else `null`  |
| `clampSeatCount`    | `(seats: number, max: number) => number` | Truncates and clamps into `[1, max]`       |

## Used by

- `web-billing-page.tsx` — the `/billing` Seats stepper (`MAX_BILLING_SEATS = 999`).

## Agent Decisions / Thoughts

- **2026-09-20 Devin:** Edit semantics: sanitize on change, apply only valid counts ≥1 live, commit on blur/Enter, Escape reverts. `clampSeatCount` adds the max bound the billing page declares.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-20 | Created for the editable billing Seats stepper | Devin |
