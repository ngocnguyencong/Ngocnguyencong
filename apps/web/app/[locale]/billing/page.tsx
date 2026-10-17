import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { isAppLocale } from "@supastack/i18n";
import { notFound, redirect } from "next/navigation";

import { productPlanPriceMapFromEnv, type ProductPlanId } from "../../../src/product-plans";
import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { WebBillingPage } from "../../../src/web-billing-page";

export const dynamic = "force-dynamic";

export default async function LocaleBillingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isAppLocale(locale)) {
    notFound();
  }
  if (locale === "en") {
    redirect("/billing");
  }
  const serverConfig = parseServerConfig();
  const publicConfig = parsePublicConfig(serverConfig);
  const priceMap = productPlanPriceMapFromEnv(process.env);
  const configuredPlanIds = Object.keys(priceMap) as ProductPlanId[];
  const brand = await getRequestBrand();

  return (
    <WebBillingPage
      brand={brand}
      configuredPlanIds={configuredPlanIds}
      locale={locale}
      stripeEnabled={publicConfig.providers.billing === "stripe"}
    />
  );
}
