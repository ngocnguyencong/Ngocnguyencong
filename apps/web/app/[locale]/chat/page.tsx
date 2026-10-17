import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { getReferenceMode } from "../../../src/reference-mode";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { WebChatPage } from "../../../src/web-chat-page";

export const dynamic = "force-dynamic";

export default async function LocaleChatPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    redirect("/chat");
  }
  const config = parseServerConfig();
  const publicConfig = parsePublicConfig(config);
  const mode = getReferenceMode(config);
  const aliases = mode.mode === "production" ? mode.aliases : (["fast", "smart", "cheap"] as const);
  const aiEnabled = mode.mode === "production" ? mode.aiEnabled : false;

  const brand = await getRequestBrand();

  return (
    <WebChatPage
      aiEnabled={aiEnabled}
      aliases={aliases}
      apiUrl={publicConfig.app.apiUrl}
      brand={brand}
      locale={locale}
    />
  );
}
