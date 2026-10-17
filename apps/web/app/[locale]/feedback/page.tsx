import { isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { listFeatureRequests } from "../../../src/feature-board-actions";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { WebFeatureBoardPage } from "../../../src/web-feature-board-page";

export const dynamic = "force-dynamic";

export default async function LocaleFeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    redirect("/feedback");
  }
  const [result, brand] = await Promise.all([listFeatureRequests(), getRequestBrand()]);
  return (
    <WebFeatureBoardPage
      brand={brand}
      canManage={result.canManage}
      canWrite={result.canWrite}
      error={result.error}
      locale={locale}
      myVoteIds={result.myVoteIds}
      requests={result.requests}
    />
  );
}
