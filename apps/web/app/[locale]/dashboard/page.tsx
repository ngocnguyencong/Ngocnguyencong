import { isAppLocale, localePath } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { firstSearchParam, taskRecoveryHref } from "../../../src/ai-task-recovery";

export default async function LocaleDashboardPage({
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
  // The AI task console moved to /{locale}/ai; keep previously shared
  // task/submission recovery links landing on it.
  const query = (await searchParams) ?? {};
  const recovery = taskRecoveryHref(query, localePath(locale, "/ai"));
  if (recovery !== null) {
    redirect(recovery);
  }
  // Canonicalize to /dashboard but keep the params the analytics page reads.
  const rest = new URLSearchParams();
  const site = firstSearchParam(query.site);
  const period = firstSearchParam(query.period);
  if (site !== undefined) rest.set("site", site);
  if (period !== undefined) rest.set("period", period);
  redirect(`/dashboard${rest.size > 0 ? `?${rest.toString()}` : ""}`);
}
