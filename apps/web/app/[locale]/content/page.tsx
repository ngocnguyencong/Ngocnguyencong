import { isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { listContentEntries } from "../../../src/content-actions";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { WebContentPage } from "../../../src/web-content-page";

export const dynamic = "force-dynamic";

export default async function LocaleContentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    redirect("/content");
  }
  const [result, brand] = await Promise.all([listContentEntries(), getRequestBrand()]);
  return (
    <WebContentPage
      brand={brand}
      entries={result.entries}
      error={result.error}
      locale={locale}
      writable={result.writable}
    />
  );
}
