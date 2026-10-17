import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveLocale } from "@supastack/i18n";
import { docsHref } from "../../../src/resources/docs-copy";
import { DocsPage } from "../../../src/resources/resource-pages";
import { docsMetadata, docsPageData } from "../../../src/resources/docs-route";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ q?: string | string[] }>;
};
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [route, search] = await Promise.all([params, searchParams]);
  return docsMetadata("en", route.slug, search.q);
}
export default async function Page({ params, searchParams }: Props) {
  const [route, search] = await Promise.all([params, searchParams]);
  const requestHeaders = await headers();
  const locale = resolveLocale([requestHeaders.get("x-supastack-locale")]);
  if (locale !== "en") {
    const path = route.slug?.length ? `/docs/${route.slug.join("/")}` : "/docs";
    const query = typeof search.q === "string" ? `?${new URLSearchParams({ q: search.q })}` : "";
    redirect(docsHref(locale, `${path}${query}`));
  }
  const { guide, query, entries, results } = docsPageData("en", route.slug, search.q);
  if (!guide) notFound();
  return (
    <DocsPage guide={guide} query={query} entries={entries} {...(results ? { results } : {})} />
  );
}
