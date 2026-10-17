# seat-count.test.ts

> Last updated: 2026-09-20 | Protection: STANDARD

## Purpose

Unit tests for the editable seat-input helpers in `seat-count.ts`.

## Coverage

- `sanitizeSeatInput` strips non-digit characters.
- `parseSeatInput` rejects empty/non-digit/zero drafts and parses counts ≥ 1.
- `clampSeatCount` keeps counts inside `[1, max]`.

## Change History

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-09-20 | Created | Devin |
