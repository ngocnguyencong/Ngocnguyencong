import { guides, posts } from "../resources/content";
import { localePath, SUPPORTED_LOCALES } from "@supastack/i18n";

export const marketingStaticPaths = [
  "/",
  "/faq",
  "/blog",
  "/docs",
  "/contact",
  "/privacy",
  "/terms",
  "/legal/acceptable-use",
  "/legal/disclaimer",
  "/legal/license",
  "/showcase",
  "/changelog",
  "/roadmap",
  "/api-reference",
] as const;

export type MarketingSitemapEntry = {
  path: string;
  lastModified?: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
};

const STATIC_ENTRY_META: Record<
  (typeof marketingStaticPaths)[number],
  Pick<MarketingSitemapEntry, "changeFrequency" | "priority">
> = {
  "/": { changeFrequency: "weekly", priority: 1 },
  "/faq": { changeFrequency: "monthly", priority: 0.7 },
  "/blog": { changeFrequency: "weekly", priority: 0.8 },
  "/docs": { changeFrequency: "weekly", priority: 0.8 },
  "/contact": { changeFrequency: "monthly", priority: 0.5 },
  "/privacy": { changeFrequency: "yearly", priority: 0.3 },
  "/terms": { changeFrequency: "yearly", priority: 0.3 },
  "/legal/acceptable-use": { changeFrequency: "yearly", priority: 0.3 },
  "/legal/disclaimer": { changeFrequency: "yearly", priority: 0.3 },
  "/legal/license": { changeFrequency: "yearly", priority: 0.3 },
  "/showcase": { changeFrequency: "monthly", priority: 0.5 },
  "/changelog": { changeFrequency: "weekly", priority: 0.7 },
  "/roadmap": { changeFrequency: "monthly", priority: 0.5 },
  "/api-reference": { changeFrequency: "monthly", priority: 0.5 },
};

export function buildMarketingSitemapEntries(input?: {
  posts?: readonly { slug: string; date?: string }[];
  guides?: readonly { slug: string }[];
}): MarketingSitemapEntry[] {
  const articles = input?.posts ?? posts;
  const docs = input?.guides ?? guides;
  return [
    ...marketingStaticPaths.map((path) => ({ path, ...STATIC_ENTRY_META[path] })),
    ...articles.map((post) => ({
      path: `/blog/${post.slug}`,
      ...(post.date ? { lastModified: post.date } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...SUPPORTED_LOCALES.filter((locale) => locale !== "en").map((locale) => ({
      path: localePath(locale, "/docs"),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...docs.flatMap((guide) =>
      SUPPORTED_LOCALES.map((locale) => ({
        path: localePath(locale, `/docs/${guide.slug}`),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ),
  ];
}

export function buildMarketingSitemapPaths(input?: {
  posts?: readonly { slug: string }[];
  guides?: readonly { slug: string }[];
}): string[] {
  return buildMarketingSitemapEntries(input).map((entry) => entry.path);
}
