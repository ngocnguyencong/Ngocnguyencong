# packages/supadata-sdk/src/react.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

`<SupadataScript>` — RSC-safe deferred `<script>` tag emitting the
tracker's `data-*` attributes (`data-website-id`, `data-api-url`,
`data-domain`, `data-cookieless`).

## Important Notes / NEVER Change

- Plain `<script>` only — no client hooks, so it renders inside server layouts.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | Added with the supadata analytics module | Devin |
