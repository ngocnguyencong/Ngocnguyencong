import { parsePublicConfig, parseServerConfig } from "@supastack/config";

import { productPlanPriceMapFromEnv } from "../../src/product-plans";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { WebBillingPage } from "../../src/web-billing-page";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const serverConfig = parseServerConfig();
  const publicConfig = parsePublicConfig(serverConfig);
  const priceMap = productPlanPriceMapFromEnv(process.env);
  const configuredPlanIds = Object.keys(priceMap);
  const brand = await getRequestBrand();
  return (
    <WebBillingPage
      brand={brand}
      configuredPlanIds={configuredPlanIds}
      stripeEnabled={publicConfig.providers.billing === "stripe"}
    />
  );
}
