import { describe, expect, it } from "vitest";

import { storeSubscriptionsUrl } from "./store-management";

describe("storeSubscriptionsUrl", () => {
  it("returns the fixed Apple subscription management URL for iOS", () => {
    expect(storeSubscriptionsUrl("ios")).toBe("https://apps.apple.com/account/subscriptions");
  });

  it("returns the fixed Google Play subscription management URL for Android", () => {
    expect(storeSubscriptionsUrl("android")).toBe(
      "https://play.google.com/store/account/subscriptions",
    );
  });

  it("does not produce a store URL for unsupported platforms", () => {
    expect(storeSubscriptionsUrl("web")).toBeNull();
  });
});
