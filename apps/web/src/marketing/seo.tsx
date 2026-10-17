import "server-only";

import { DEFAULT_LOCALE, localePath, SUPPORTED_LOCALES, type AppLocale } from "@supastack/i18n";
import type { Metadata } from "next";

import type { Guide, Post } from "../resources/content";
import { DOCS_COPY } from "../resources/docs-copy";
import { siteConfig, type FaqItem } from "./site-config";

export type JsonLdObject = Record<string, unknown>;

/** Shared static social card; keep dimensions in sync with public/demo-social.png. */
export const rootOgImage = {
  url: "/demo-social.png",
  width: 1200,
  height: 630,
  alt: "Your app — a boilerplate demo",
} as const;

/**
 * Canonical origin for absolute SEO URLs (canonical, sitemap, robots, OG,
 * JSON-LD). Configure APP_URL per deployment; localhost keeps dev honest.
 */
export function siteOrigin(): string {
  return process.env.APP_URL || "http://localhost:3000";
}

export function absoluteUrl(path = "/"): string {
  return new URL(path, siteOrigin()).toString();
}

/**
 * Page-level `openGraph`/`twitter` metadata builder.
 *
 * Next.js merges metadata per top-level key: a segment that defines
 * `openGraph` or `twitter` REPLACES the layout's whole object — a bare
 * `{ title, description }` silently drops `siteName`, `type`, `locale`,
 * the card type, and any inherited images (observed live: homepage emitted
 * no og:image/og:site_name and twitter:card fell back to "summary").
 * Compose page social metadata through here so the shared fields survive.
 *
 * A page that defines `openGraph` without `images` replaces the layout's
 * image too. Pass `[rootOgImage]` for ordinary public pages. Leave images
 * unset only for a segment that owns a generated convention card, such as
 * `blog/[slug]`.
 */
export function pageSocialMetadata(input: {
  siteName: string;
  title: string;
  description: string;
  /** Canonical path or absolute URL — emitted as og:url. */
  url?: string;
  type?: "website" | "article";
  locale?: AppLocale;
  publishedTime?: string;
  /** Explicit card images — required on segments without their own convention card. */
  images?: NonNullable<Metadata["openGraph"]>["images"];
}): Pick<Metadata, "openGraph" | "twitter"> {
  const ogLocale = input.locale ? ogLocaleFor(input.locale) : undefined;
  const base = {
    siteName: input.siteName,
    title: input.title,
    description: input.description,
    ...(input.images ? { images: input.images } : {}),
    ...(input.url ? { url: input.url } : {}),
    ...(ogLocale
      ? {
          locale: ogLocale,
          alternateLocale: SUPPORTED_LOCALES.filter((item) => item !== input.locale).map(
            ogLocaleFor,
          ),
        }
      : {}),
  };
  return {
    // `type` discriminates the OpenGraph union — build each member literally
    // so `publishedTime` only ever appears on the article shape.
    openGraph:
      input.type === "article"
        ? {
            ...base,
            type: "article" as const,
            ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
          }
        : { ...base, type: "website" as const },
    twitter: {
      card: "summary_large_image" as const,
      title: input.title,
      description: input.description,
      ...(input.images ? { images: input.images } : {}),
    },
  };
}

/** JSON-LD safe for inline <script>: escaping < blocks </script> breakouts. */
export function jsonLdScript(data: JsonLdObject | readonly JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: JsonLdObject | readonly JsonLdObject[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}

export function organizationJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.brandName,
    url: siteOrigin(),
    ...(siteConfig.repositoryUrl ? { sameAs: [siteConfig.repositoryUrl] } : {}),
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.brandName,
    url: siteOrigin(),
    inLanguage: [...SUPPORTED_LOCALES],
  };
}

export function faqPageJsonLd(items: readonly FaqItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function blogPostingJsonLd(post: Post): JsonLdObject {
  const organization = {
    "@type": "Organization",
    name: siteConfig.brandName,
    url: siteOrigin(),
  };
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: organization,
    publisher: organization,
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function blogBreadcrumbJsonLd(post: Post): JsonLdObject {
  return breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);
}

export function docsBreadcrumbJsonLd(guide: Guide, locale: AppLocale = "en"): JsonLdObject {
  const copy = DOCS_COPY[locale];
  const home = { en: "Home", de: "Startseite", es: "Inicio", fr: "Accueil" }[locale];
  return breadcrumbJsonLd([
    { name: home, path: localePath(locale, "/") },
    { name: locale === "en" ? "Docs" : copy.documentation, path: localePath(locale, "/docs") },
    { name: copy[guide.tab], path: localePath(locale, `/docs/${guide.tab}`) },
    { name: guide.title, path: localePath(locale, `/docs/${guide.slug}`) },
  ]);
}

/**
 * hreflang map for any locale-suffixed public path: en lives at the bare
 * path, other locales at /<locale><path>. Use for pages that ship a
 * matching `app/[locale]` route.
 */
export function pageLanguageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, localePath(locale, path)])),
    "x-default": localePath(DEFAULT_LOCALE, path),
  };
}

/** hreflang map for locale-suffixed pages: en lives at /, others at /<locale>. */
export function homeLanguageAlternates(): Record<string, string> {
  return pageLanguageAlternates("/");
}

/** Open Graph locale codes (en -> en_US, de -> de_DE, ...). */
export function ogLocaleFor(locale: AppLocale): string {
  return locale === DEFAULT_LOCALE ? "en_US" : `${locale}_${locale.toUpperCase()}`;
}
