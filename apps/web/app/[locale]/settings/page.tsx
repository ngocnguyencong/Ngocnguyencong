import { isAppLocale, localePath } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

export default async function LocaleSettingsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  redirect(localePath(locale, "/settings/general"));
}
