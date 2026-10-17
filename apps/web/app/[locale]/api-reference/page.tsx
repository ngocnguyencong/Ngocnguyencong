import { isAppLocale, localePath } from "@supastack/i18n";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { apiReferenceGroups } from "../../../src/marketing/api-reference";
import { ApiReferencePage, apiReferencePageMeta } from "../../../src/marketing/api-reference-page";
import { RESOURCE_COPY } from "../../../src/marketing/resource-copy";
import {
  breadcrumbJsonLd,
  JsonLd,
  pageLanguageAlternates,
  pageSocialMetadata,
  rootOgImage,
} from "../../../src/marketing/seo";
import { ResourceShell } from "../../../src/resources/resource-shell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const copy = RESOURCE_COPY[locale].apiReference;
  const brand = await getRequestBrand();
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: localePath(locale, apiReferencePageMeta.path),
      languages: pageLanguageAlternates(apiReferencePageMeta.path),
    },
    ...pageSocialMetadata({
      siteName: brand.name,
      title: copy.title,
      description: copy.description,
      url: localePath(locale, apiReferencePageMeta.path),
      locale,
      // Page-level openGraph replaces the layout's image, so keep it explicit.
      images: [rootOgImage],
    }),
  };
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    redirect(apiReferencePageMeta.path);
  }
  const copy = RESOURCE_COPY[locale];
  return (
    <ResourceShell active="api-reference" locale={locale}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: copy.home, path: localePath(locale, "/") },
          {
            name: copy.apiReference.title,
            path: localePath(locale, apiReferencePageMeta.path),
          },
        ])}
      />
      <ApiReferencePage groups={apiReferenceGroups()} locale={locale} />
    </ResourceShell>
  );
}
