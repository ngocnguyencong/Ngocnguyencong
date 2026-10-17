import { parseServerConfig } from "@supastack/config";
import { isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { taskRecoveryHref } from "../../../src/ai-task-recovery";
import { ProductionReferenceApp } from "../../../src/production-reference-app";
import { ReferenceApp } from "../../../src/reference-app";
import { getReferenceMode } from "../../../src/reference-mode";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { getGithubConnection } from "../../../src/auth-runtime";

export const dynamic = "force-dynamic";

export default async function LocaleAiPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    // Keep shared task/submission recovery links intact on the canonical route.
    const query = (await searchParams) ?? {};
    redirect(taskRecoveryHref(query) ?? "/ai");
  }
  const mode = getReferenceMode(parseServerConfig());
  const brand = await getRequestBrand();
  if (mode.mode === "local") return <ReferenceApp brand={brand} locale={locale} />;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${proto}://${host.split(",")[0]!.trim()}` : "";
  return (
    <ProductionReferenceApp
      aiEnabled={mode.aiEnabled}
      aliases={mode.aliases}
      brand={brand}
      githubApiUrl={requestOrigin}
      githubCallbackURL={`${requestOrigin}/${locale}/ai`}
      githubConnection={await getGithubConnection(requestHeaders)}
      locale={locale}
    />
  );
}
