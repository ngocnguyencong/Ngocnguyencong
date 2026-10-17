import type { Metadata } from "next";
import { getRequestBrand } from "../src/custom-domains/runtime";
import { marketingFontClassName } from "../src/marketing/fonts";
import {
  JsonLd,
  organizationJsonLd,
  rootOgImage,
  siteOrigin,
  webSiteJsonLd,
} from "../src/marketing/seo";
import { themeStylesheet } from "../src/theme/catalog";
import { DEFAULT_STYLE_ATTRIBUTES, THEME_BOOT_SCRIPT } from "../src/theme/theme-boot";
import { Toaster } from "../src/toast";

import "./globals.css";
import "./foundation.css";
import "./theme.css";
import "./app-theme.css";

const description = "A boilerplate demo for web, mobile, and desktop applications.";

export async function generateMetadata(): Promise<Metadata> {
  // With custom domains off this returns the default brand without touching
  // request state, so static rendering is unaffected; with them on, the title
  // carries the resolved workspace name for white-label hosts.
  const brand = await getRequestBrand();
  return {
    metadataBase: new URL(siteOrigin()),
    description,
    title: {
      default: brand.name,
      template: `%s | ${brand.name}`,
    },
    openGraph: {
      // No title/description here: leaving them unset lets Next autofill each
      // page's resolved title/description — a literal would stamp the generic
      // brand onto every page's card.
      siteName: brand.name,
      type: "website",
      locale: "en_US",
      alternateLocale: ["de_DE", "es_ES", "fr_FR"],
      images: [rootOgImage],
    },
    twitter: {
      card: "summary_large_image",
      images: [rootOgImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" {...DEFAULT_STYLE_ATTRIBUTES} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStylesheet() }} id="supastack-themes" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={marketingFontClassName}>
        <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
