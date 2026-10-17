import type { MetadataRoute } from "next";

import { buildMarketingSitemapEntries } from "../src/marketing/marketing-sitemap";
import { siteOrigin } from "../src/marketing/seo";

// Every entry URL is absolute — resolve siteOrigin() per request, not at build
// time where APP_URL is unset and the origin would bake to localhost:3000.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return buildMarketingSitemapEntries().map((entry) => ({
    url: new URL(entry.path, origin).toString(),
    ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
