import type { AppLocale } from "@supastack/i18n";

import { resolveAnalyticsConfig } from "../analytics";
import { LanguageSwitcher } from "../i18n/language-switcher";
import { ThemeMenu } from "../theme/theme-menu";
import { copyForLocale } from "../ui/ui-copy";
import { MarketingAnalytics } from "./analytics-script";
import { ConsentBanner, ConsentPreferencesButton } from "./consent-banner";
import { clientCaptureEnabledFor } from "./marketing-consent";
import {
  isActiveSection,
  optionalExternalLinks,
  siteConfig,
  type MarketingSection,
} from "./site-config";
import styles from "./marketing.module.css";

export function SiteFooter({
  active,
  locale = "en",
}: { active?: MarketingSection; locale?: AppLocale } = {}) {
  const hrefFor = (href: string) => (active && href.startsWith("#") ? `/${href}` : href);
  const extra = optionalExternalLinks(siteConfig);
  const captureEnabled = clientCaptureEnabledFor(resolveAnalyticsConfig());

  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <a aria-label="supastack home" className={`${styles.brand} brand`} href="/">
          <span>{siteConfig.brandName}</span>
        </a>
        <p>{siteConfig.tagline}</p>
      </div>
      <div className={styles.footerNavs}>
        <nav aria-label="Footer">
          {siteConfig.navigation.map((item) => (
            <a
              href={hrefFor(item.href)}
              aria-current={isActiveSection(item.href, active) ? "page" : undefined}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
          {extra.map((item) => (
            <a
              href={hrefFor(item.href)}
              aria-current={isActiveSection(item.href, active) ? "page" : undefined}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Resources">
          {siteConfig.resourceLinks.map((item) => (
            <a
              href={item.href}
              aria-current={isActiveSection(item.href, active) ? "page" : undefined}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <nav aria-label="Legal">
          {siteConfig.footerLinks.map((item) => (
            <a
              href={item.href}
              aria-current={isActiveSection(item.href, active) ? "page" : undefined}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      <div className={styles.footerBar}>
        <ConsentPreferencesButton
          clientCaptureEnabled={captureEnabled}
          label={copyForLocale(locale).consent.preferences}
        />
        <ThemeMenu label={copyForLocale(locale).appearance.theme} side="top" align="start" />
        <LanguageSwitcher side="top" align="start" />
      </div>
      <ConsentBanner clientCaptureEnabled={captureEnabled} locale={locale} />
      <MarketingAnalytics />
    </footer>
  );
}
