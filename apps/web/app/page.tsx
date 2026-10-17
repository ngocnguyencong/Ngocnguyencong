import { getDictionary } from "@supastack/i18n";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { firstSearchParam, taskRecoveryHref } from "../src/ai-task-recovery";
import { getRequestBrand } from "../src/custom-domains/runtime";
import { LandingPage } from "../src/landing-page";
import { loadLandingPreview } from "../src/landing-preview";
import { homeLanguageAlternates, pageSocialMetadata, rootOgImage } from "../src/marketing/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getRequestBrand();
  const copy = getDictionary("en").marketingLanding;
  const title = `${brand.name} — ${copy.metadataTitle}`;
  const description = copy.metadataDescription;
  return {
    // absolute — the title already carries the brand; the layout template
    // would otherwise append "| supastack" a second time.
    title: { absolute: title },
    description,
    alternates: {
      canonical: "/",
      languages: homeLanguageAlternates(),
    },
    ...pageSocialMetadata({
      siteName: brand.name,
      title,
      description,
      url: "/",
      images: [rootOgImage],
    }),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Preserve previously shared task and submission recovery links; the AI task
  // console now lives at /ai.
  const recovery = taskRecoveryHref(query);
  if (recovery !== null) {
    redirect(recovery);
  }
  const preview = await loadLandingPreview();
  return (
    <LandingPage
      preview={preview}
      waitlist={{
        status: firstSearchParam(query.waitlist),
        position: firstSearchParam(query.position),
        code: firstSearchParam(query.code),
      }}
    />
  );
}
