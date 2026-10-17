import { describe, expect, it } from "vitest";

import { resolvePurchasesConfiguration } from "./config";

describe("resolvePurchasesConfiguration", () => {
  it("defaults to purchases off", () => {
    expect(resolvePurchasesConfiguration({ dev: false, platform: "ios" })).toEqual({ kind: "off" });
  });

  it("only permits the fake provider in explicit development mode", () => {
    expect(resolvePurchasesConfiguration({ dev: true, platform: "ios", provider: "fake" })).toEqual(
      { kind: "fake" },
    );
    expect(
      resolvePurchasesConfiguration({ dev: false, platform: "ios", provider: "fake" }),
    ).toEqual({ kind: "off" });
  });

  it("requires the platform-matching public RevenueCat key", () => {
    expect(
      resolvePurchasesConfiguration({
        androidApiKey: "android-public-key",
        dev: false,
        platform: "android",
        provider: "revenuecat",
      }),
    ).toEqual({ apiKey: "android-public-key", kind: "revenuecat" });
    expect(
      resolvePurchasesConfiguration({
        dev: false,
        iosApiKey: "ios-public-key",
        platform: "android",
        provider: "revenuecat",
      }),
    ).toEqual({ kind: "off" });
  });
});
