# apps/web/src/format.test.ts

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Coverage for `format.ts` — template interpolation helpers.

## Coverage

- `formatTemplate` — interpolates own-property placeholders, leaves
  unknown ones intact, does not substitute inherited
  `Object.prototype` members.
- `splitTemplate` — splits around the placeholder, passes templates
  without it through.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Merged via feat/prod-ready-kit — initial mirror | Devin |
