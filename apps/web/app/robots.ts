import type { MetadataRoute } from "next";

import { siteOrigin } from "../src/marketing/seo";

// The sitemap URL is absolute — resolve siteOrigin() per request, not at build
// time where APP_URL is unset and the origin would bake to localhost:3000.
export const dynamic = "force-dynamic";

// App/authenticated surfaces stay out of the index; marketing routes stay open.
const APP_ROUTE_PREFIXES = [
  "/admin",
  "/ai",
  "/api/",
  "/auth",
  "/billing",
  "/chat",
  "/choose-plan",
  "/commerce",
  "/content",
  "/dashboard",
  "/feedback",
  "/invite",
  "/mail-preview",
  "/new-organization",
  "/onboarding",
  "/organization",
  "/select-organization",
  "/settings",
  "/setup",
  "/kit-blocks",
  "/landing-v2",
] as const;

// Locale-prefixed mirrors of the app routes (/<locale>/dashboard etc.).
const LOCALIZED_APP_PREFIXES = [
  "/*/ai",
  "/*/billing",
  "/*/chat",
  "/*/commerce",
  "/*/content",
  "/*/dashboard",
  "/*/feedback",
  "/*/settings",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...APP_ROUTE_PREFIXES, ...LOCALIZED_APP_PREFIXES],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
