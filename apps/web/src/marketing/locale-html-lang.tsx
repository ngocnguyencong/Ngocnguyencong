"use client";

import { useEffect } from "react";

/**
 * The root layout owns <html lang="en"> and App Router gives child segments no
 * way to change it server-side. Locale-prefixed pages mount this to sync the
 * attribute post-hydration; hreflang alternates carry the SEO signal either way.
 */
export function LocaleHtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
