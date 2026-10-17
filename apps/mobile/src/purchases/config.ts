export type MobilePurchaseProviderMode = "fake" | "off" | "revenuecat";

export type MobilePurchaseConfiguration =
  | Readonly<{ kind: "off" }>
  | Readonly<{ kind: "fake" }>
  | Readonly<{ apiKey: string; kind: "revenuecat" }>;

export function resolvePurchasesConfiguration(input: {
  androidApiKey?: string | undefined;
  dev: boolean;
  iosApiKey?: string | undefined;
  platform: string;
  provider?: string | undefined;
}): MobilePurchaseConfiguration {
  const provider = input.provider?.trim().toLowerCase() || "off";

  if (provider === "fake") return input.dev ? { kind: "fake" } : { kind: "off" };
  if (provider !== "revenuecat") return { kind: "off" };

  const apiKey =
    input.platform === "ios"
      ? input.iosApiKey
      : input.platform === "android"
        ? input.androidApiKey
        : undefined;
  if (!apiKey?.trim()) return { kind: "off" };

  return { apiKey: apiKey.trim(), kind: "revenuecat" };
}
