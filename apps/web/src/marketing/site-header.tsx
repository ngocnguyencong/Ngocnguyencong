import type { AppLocale } from "@supastack/i18n";

import { SiteHeaderClient } from "./site-header-client";
import type { MarketingSection } from "./site-config";
import { getViewerSnapshot } from "./viewer-snapshot";

/**
 * Server shell around the interactive header — resolves the viewer once per
 * request so the SSR markup already carries the right account action and the
 * client hydrate does not repaint it (full-page nav resets the browser
 * session cache on every marketing link click).
 */
export async function SiteHeader({
  active,
  locale = "en",
}: { active?: MarketingSection; locale?: AppLocale } = {}) {
  const viewer = await getViewerSnapshot();
  return <SiteHeaderClient active={active} locale={locale} viewer={viewer} />;
}
