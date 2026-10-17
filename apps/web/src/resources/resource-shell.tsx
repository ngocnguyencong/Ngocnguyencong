import type { ReactNode } from "react";
import type { AppLocale } from "@supastack/i18n";
import { DOCS_COPY } from "./docs-copy";
import { marketingFontClassName } from "../marketing/fonts";
import { LocaleHtmlLang } from "../marketing/locale-html-lang";
import { SiteHeader } from "../marketing/site-header";
import { SiteFooter } from "../marketing/site-footer";
import type { MarketingSection } from "../marketing/site-config";
import { marketingThemeAttrs } from "../theme/marketing-theme";
import home from "../marketing/marketing.module.css";
import styles from "./resources.module.css";
export function ResourceShell({
  children,
  active,
  locale = "en",
}: {
  children: ReactNode;
  active: MarketingSection;
  locale?: AppLocale;
}) {
  return (
    <div
      lang={locale}
      className={`marketing-theme ${home.home} ${marketingFontClassName} ${styles.root}`}
      {...marketingThemeAttrs()}
    >
      {/* The root layout owns <html lang="en"> — this syncs the attribute to
          the rendered locale post-hydration (no-op on English pages). */}
      <LocaleHtmlLang locale={locale} />
      <a className={home.skip} href="#main">
        {DOCS_COPY[locale].skip}
      </a>
      <SiteHeader active={active} locale={locale} />
      {children}
      <SiteFooter active={active} locale={locale} />
    </div>
  );
}
