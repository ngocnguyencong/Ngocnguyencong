# apps/web/app/contact/page.tsx

> Last updated: 2026-09-22 | Protection: STANDARD

## Purpose

`/contact` route — reads `?status`/`?form` for the post-submit banner and
renders `ContactPage` inside `ResourceShell`.

## Important Notes

- Reads `parsePublicConfig(parseServerConfig()).captcha` and passes
  `turnstileSiteKey` to `ContactPage` only when provider is `turnstile`.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-09-24 | `force-dynamic` — canonical/og:image 在请求时解析 APP_URL(静态构建会烘 localhost:3000) | Devin |
| 2026-09-22 | Wire Turnstile site key into `ContactPage` | Devin |
