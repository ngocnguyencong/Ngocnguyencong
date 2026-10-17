import { localePath, resolveLocale } from "@supastack/i18n";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { RESOURCE_COPY } from "../../src/marketing/resource-copy";
import { RoadmapPage, roadmapPageMeta } from "../../src/marketing/roadmap-page";
import { breadcrumbJsonLd, JsonLd, pageLanguageAlternates } from "../../src/marketing/seo";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: roadmapPageMeta.title,
  description: roadmapPageMeta.description,
  alternates: {
    canonical: roadmapPageMeta.path,
    languages: pageLanguageAlternates(roadmapPageMeta.path),
  },
};

export default async function Page() {
  const requestHeaders = await headers();
  const locale = resolveLocale([requestHeaders.get("x-supastack-locale")]);
  if (locale !== "en") {
    redirect(localePath(locale, roadmapPageMeta.path));
  }
  const copy = RESOURCE_COPY[locale];
  return (
    <ResourceShell active="roadmap" locale={locale}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: copy.home, path: "/" },
          { name: copy.roadmap.title, path: roadmapPageMeta.path },
        ])}
      />
      <RoadmapPage locale={locale} />
    </ResourceShell>
  );
}
