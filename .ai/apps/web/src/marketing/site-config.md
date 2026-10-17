# src/marketing/site-config.ts

> Last updated: 2026-10-10 | Protection: STANDARD

## Purpose（一句话人话）

marketing 站点配置单一来源 —— 品牌名、导航/页脚链接、FAQ 文案、可选外链
（docs/repository 仅在配置后渲染）。

## Important Notes

- The tagline identifies a boilerplate demo. FAQ wording is neutral sample
  content, including an explicit explanation that prices are illustrative.
  Keep navigation and factual module boundaries intact; do not import real
  promotional copy, customer proof, or sales claims.

- `navigation` 顺序即 header 渲染顺序；`/#waitlist` 锚点指向 landing 的
  waitlist band（id="waitlist"）。
- site-header 把 `label` 映射到 `copy.nav.*`（新增 label 要配 i18n key）。
- `faq` is shared by the homepage, `/faq`, search, and FAQ structured data. Its
  mobile-purchases answer describes native RevenueCat purchase/restore,
  server-verified workspace access, and separate web billing.
- `footerLinks` = Legal nav (showcase/contact/privacy/terms/acceptable-use/
  disclaimer/license)；`isActiveSection(href, active)` 用后缀匹配
  (`endsWith(\`/${active}\`)`) 处理 `/legal/license` ↔ `active="license"`
  —— header/footer 的 `aria-current` 统一走它，外链永不命中。
- `resourceLinks` = Resources footer nav (changelog/roadmap/api-reference) —
  public docs-adjacent destinations grouped separately from Legal; labels are
  rendered raw like footerLinks (no i18n key mapping). `MarketingSection`
  gained matching `"changelog" | "roadmap" | "api-reference"` members for
  `active` highlighting.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-10-10 | `resourceLinks` group +`/changelog` `/roadmap` `/api-reference`；MarketingSection +`changelog`/`roadmap`/`api-reference` | Devin |
| 2026-09-27 | footerLinks +`/legal/acceptable-use` +`/legal/disclaimer`；MarketingSection +`acceptable-use`/`disclaimer` | Devin |
| 2026-09-27 | footerLinks +`/legal/license`；MarketingSection +`license`；新增 `isActiveSection` | Devin |
| 2026-09-22 | navigation +`/#waitlist`（Waitlist） | Devin |
| 2026-10-01 | FAQ explains configured native RevenueCat purchases, server-verified workspace access, and separate web billing | Codex |
| 2026-10-04 | Neutral demo tagline and rewritten example FAQ; prices explicitly illustrative | Codex |
