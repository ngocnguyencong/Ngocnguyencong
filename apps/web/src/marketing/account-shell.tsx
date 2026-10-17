import type { AppLocale } from "@supastack/i18n";
import type { ReactNode } from "react";

import { marketingThemeAttrs } from "../theme/marketing-theme";
import { ConsentBanner } from "./consent-banner";
import home from "./marketing.module.css";
import { marketingFontClassName } from "./fonts";
// This shell also renders inside client components (the auth pages), where an
// async server component cannot mount — it uses the plain client header, which
// falls back to the browser session check when no viewer snapshot is passed.
import { SiteHeaderClient } from "./site-header-client";

export function MarketingAccountShell({
  children,
  locale,
  captureEnabled,
}: {
  children?: ReactNode;
  locale?: AppLocale;
  /**
   * Resolved on the server by the caller — this shell is also rendered inside
   * client components (auth pages), so it cannot read server config itself.
   */
  captureEnabled: boolean;
}) {
  return (
    <div
      className={`marketing-theme app-theme ${home.home} ${marketingFontClassName}`}
      {...marketingThemeAttrs()}
    >
      <a className={home.skip} href="#main">
        Skip to content
      </a>
      <SiteHeaderClient locale={locale ?? "en"} />
      {children}
      <ConsentBanner clientCaptureEnabled={captureEnabled} locale={locale ?? "en"} />
    </div>
  );
}
