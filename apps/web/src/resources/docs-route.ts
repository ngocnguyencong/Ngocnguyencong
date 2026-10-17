import { SUPPORTED_LOCALES, type AppLocale } from "@supastack/i18n";
import type { Metadata } from "next";
import { searchGuides } from "./content";
import { DOCS_COPY, docsHref } from "./docs-copy";
import { localizedGuides } from "./docs-i18n";

export function docsPageData(
  locale: AppLocale,
  slug?: readonly string[],
  queryValue?: string | string[],
) {
  const entries = localizedGuides(locale);
  const guide = entries.find((item) => item.slug === (slug?.join("/") || "web"));
  const query = typeof queryValue === "string" ? queryValue.trim().slice(0, 200) : "";
  return { entries, guide, query, ...(query ? { results: searchGuides(query, entries) } : {}) };
}

export function docsMetadata(
  locale: AppLocale,
  slug?: readonly string[],
  queryValue?: string | string[],
): Metadata {
  const { guide, query } = docsPageData(locale, slug, queryValue);
  const copy = DOCS_COPY[locale];
  const path = !query && slug?.length && guide ? `/docs/${guide.slug}` : "/docs";
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((language) => [language, docsHref(language, path)]),
  );
  return {
    title: `${query ? copy.searchTitle : (guide?.title ?? copy.notFound)} — ${copy.documentation}`,
    description: guide?.description,
    alternates: {
      canonical: docsHref(locale, path),
      languages: { ...languages, "x-default": path },
    },
    ...(query || !guide ? { robots: { index: false, follow: true } } : {}),
  };
}
