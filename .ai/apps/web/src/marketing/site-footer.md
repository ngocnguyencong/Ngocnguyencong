# src/marketing/site-footer.tsx

> Last updated: 2026-10-11 | Protection: STANDARD

## Purpose

Marketing footer: brand + tagline column, "Footer" nav (`siteConfig.navigation`
+ `optionalExternalLinks`), "Resources" nav (`siteConfig.resourceLinks`:
changelog, roadmap, api-reference), "Legal" nav (`siteConfig.footerLinks`:
showcase, contact, privacy, terms, acceptable-use, disclaimer, license), then
a `.footerBar` visitor-controls row (`ConsentPreferencesButton` +
`ThemeMenu` + `LanguageSwitcher`), then `ConsentBanner`
(client-capture flag + `locale`) + `MarketingAnalytics`. Takes `locale`
so the theme menu aria label, consent banner, and preferences control
all localize via `copyForLocale(locale)`.

## Important Notes

- `aria-current="page"` uses `isActiveSection(item.href, active)` from
  `site-config` — a suffix match so `active="license"` highlights
  `/legal/license` and `active="changelog"` highlights `/changelog`;
  external URLs never qualify.
- Legal + Resources destinations stay in the footer only — never in
  `siteConfig.navigation` (header nav); `site-config.test.ts` guards both.

## Change History

| Date | Change | Author |
| --- | --- | --- |
| 2026-10-11 | `.footerBar` gains `ConsentPreferencesButton` (consent re-open affordance); `ConsentBanner` receives `locale` for localized copy | Devin |
| 2026-10-10 | `MarketingAnalytics` mounted after `ConsentBanner`; both take the per-request `clientCaptureEnabled` from `resolveAnalyticsConfig()` | Devin |
| 2026-10-10 | "Resources" nav group renders `siteConfig.resourceLinks` (changelog, roadmap, api-reference) between Footer and Legal columns | Devin |
| 2026-10-09 | `locale` prop + `.footerBar` controls row (ThemeMenu, LanguageSwitcher) — visitor theme/language switching reaches marketing chrome; both popovers open upward (`side="top"`) | Devin |
| 2026-09-27 | Acceptable-use + disclaimer footer links via `footerLinks` | Devin |
| 2026-09-27 | License footer link via `footerLinks`; `aria-current` switched to `isActiveSection` | Devin |
