import Purchases from "react-native-purchases";

import { createRevenueCatProvider, type PurchasesProvider } from "./paywall";

const providers = new Map<string, PurchasesProvider>();

/** Returns the process-wide RevenueCat adapter so configure is called once. */
export function getRevenueCatPurchasesProvider(apiKey: string): PurchasesProvider {
  const existing = providers.get(apiKey);
  if (existing) return existing;

  const provider = createRevenueCatProvider(
    {
      configure({ apiKey: configuredApiKey, appUserId }) {
        Purchases.configure({ apiKey: configuredApiKey, appUserID: appUserId });
      },
      async getOfferings() {
        return Purchases.getOfferings();
      },
      async logIn(appUserId) {
        return Purchases.logIn(appUserId);
      },
      async purchasePackage(identifier) {
        const offerings = await Purchases.getOfferings();
        const selected = offerings.current?.availablePackages.find(
          (entry) => entry.identifier === identifier,
        );
        if (!selected)
          throw new Error("That store plan is no longer available. Refresh and retry.");
        return Purchases.purchasePackage(selected);
      },
      async restorePurchases() {
        return Purchases.restorePurchases();
      },
    },
    apiKey,
  );

  providers.set(apiKey, provider);
  return provider;
}
