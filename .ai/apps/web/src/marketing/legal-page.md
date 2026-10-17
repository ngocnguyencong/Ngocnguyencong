# src/marketing/legal-page.tsx

> Last updated: 2026-09-27 | Protection: STANDARD

## Purpose

Shared renderer for the legal documents in `legal-content.ts` — centered title
+ "Updated <date>" line, then each section as heading + body. Sections with
`items` render a `<ul>` under the body (license can/can't lists). Styled by
`utility-page.module.css` inside `ResourceShell`.

## Important Notes

- Server component; pages pass the whole `LegalDocument` in.
- `<ul>`/`<li>` prose styles live in `utility-page.module.css`
  (`.prose section ul` / `li` / `li::marker`).

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-27 | Render optional `section.items` bullet lists (license page) | Devin |
