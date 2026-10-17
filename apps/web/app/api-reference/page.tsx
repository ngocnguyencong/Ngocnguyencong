import { localePath, resolveLocale } from "@supastack/i18n";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { apiReferenceGroups } from "../../src/marketing/api-reference";
import { ApiReferencePage, apiReferencePageMeta } from "../../src/marketing/api-reference-page";
import { RESOURCE_COPY } from "../../src/marketing/resource-copy";
import { breadcrumbJsonLd, JsonLd, pageLanguageAlternates } from "../../src/marketing/seo";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: apiReferencePageMeta.title,
  description: apiReferencePageMeta.description,
  alternates: {
    canonical: apiReferencePageMeta.path,
    languages: pageLanguageAlternates(apiReferencePageMeta.path),
  },
};

export default async function Page() {
  const requestHeaders = await headers();
  const locale = resolveLocale([requestHeaders.get("x-supastack-locale")]);
  if (locale !== "en") {
    redirect(localePath(locale, apiReferencePageMeta.path));
  }
  const copy = RESOURCE_COPY[locale];
  return (
    <ResourceShell active="api-reference" locale={locale}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: copy.home, path: "/" },
          { name: copy.apiReference.title, path: apiReferencePageMeta.path },
        ])}
      />
      <ApiReferencePage groups={apiReferenceGroups()} locale={locale} />
    </ResourceShell>
  );
}
