import { localePath, resolveLocale } from "@supastack/i18n";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ChangelogPage, changelogPageMeta } from "../../src/marketing/changelog-page";
import { RESOURCE_COPY } from "../../src/marketing/resource-copy";
import { breadcrumbJsonLd, JsonLd, pageLanguageAlternates } from "../../src/marketing/seo";
import { ResourceShell } from "../../src/resources/resource-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: changelogPageMeta.title,
  description: changelogPageMeta.description,
  alternates: {
    canonical: changelogPageMeta.path,
    languages: pageLanguageAlternates(changelogPageMeta.path),
  },
};

export default async function Page() {
  const requestHeaders = await headers();
  const locale = resolveLocale([requestHeaders.get("x-supastack-locale")]);
  if (locale !== "en") {
    redirect(localePath(locale, changelogPageMeta.path));
  }
  const copy = RESOURCE_COPY[locale];
  return (
    <ResourceShell active="changelog" locale={locale}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: copy.home, path: "/" },
          { name: copy.changelog.title, path: changelogPageMeta.path },
        ])}
      />
      <ChangelogPage locale={locale} />
    </ResourceShell>
  );
}
