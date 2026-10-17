import { getDictionary, isAppLocale, localePath } from "@supastack/i18n";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { firstSearchParam, taskRecoveryHref } from "../../src/ai-task-recovery";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { LandingPage } from "../../src/landing-page";
import { homeLanguageAlternates, pageSocialMetadata, rootOgImage } from "../../src/marketing/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isAppLocale(locale)) return {};
  const brand = await getRequestBrand();
  const copy = getDictionary(locale).marketingLanding;
  const title = `${brand.name} — ${copy.metadataTitle}`;
  const description = copy.metadataDescription;
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: localePath(locale, "/"),
      languages: homeLanguageAlternates(),
    },
    ...pageSocialMetadata({
      siteName: brand.name,
      title,
      description,
      url: localePath(locale, "/"),
      locale,
      // Page-level openGraph replaces the layout's image, so keep it explicit.
      images: [rootOgImage],
    }),
  };
}

export default async function LocaleHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  const query = await searchParams;
  // Keep previously shared task/submission recovery links landing on the
  // console: en canonicalizes to / (then to /ai when params are present),
  // other locales go straight to /{locale}/ai.
  if (locale === "en") {
    redirect(taskRecoveryHref(query) ?? "/");
  }
  const recovery = taskRecoveryHref(query, localePath(locale, "/ai"));
  if (recovery !== null) {
    redirect(recovery);
  }
  return (
    <LandingPage
      locale={locale}
      waitlist={{
        status: firstSearchParam(query.waitlist),
        position: firstSearchParam(query.position),
        code: firstSearchParam(query.code),
      }}
    />
  );
}
