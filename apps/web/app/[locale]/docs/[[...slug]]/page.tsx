import { isAppLocale } from "@supastack/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsPage } from "../../../../src/resources/resource-pages";
import { docsMetadata, docsPageData } from "../../../../src/resources/docs-route";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [route, search] = await Promise.all([params, searchParams]);
  return isAppLocale(route.locale) ? docsMetadata(route.locale, route.slug, search.q) : {};
}

export default async function Page({ params, searchParams }: Props) {
  const [route, search] = await Promise.all([params, searchParams]);
  if (!isAppLocale(route.locale)) notFound();
  const { guide, query, entries, results } = docsPageData(route.locale, route.slug, search.q);
  if (!guide) notFound();
  return (
    <DocsPage
      guide={guide}
      query={query}
      entries={entries}
      locale={route.locale}
      {...(results ? { results } : {})}
    />
  );
}
