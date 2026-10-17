import { describe, expect, it, vi } from "vitest";

import {
  createFakePurchasesProvider,
  reducePaywallEvent,
  toPaywallPresentation,
  type PaywallState,
} from "./paywall";

describe("paywall state machine", () => {
  const idle: PaywallState = { kind: "idle" };

  it("moves idle → purchasing → success/failure and back", () => {
    const purchasing = reducePaywallEvent(idle, { kind: "purchase_started" });
    expect(purchasing).toEqual({ kind: "purchasing", packageId: null });

    expect(
      reducePaywallEvent(purchasing, { kind: "purchase_succeeded", entitlement: "pro" }),
    ).toEqual({ entitlement: "pro", kind: "success" });

    const failed = reducePaywallEvent(purchasing, {
      kind: "purchase_failed",
      message: "Declined",
    });
    expect(failed).toEqual({ kind: "failure", message: "Declined" });
    expect(reducePaywallEvent(failed, { kind: "reset" })).toEqual({ kind: "idle" });
  });

  it("supports restore flow and user cancellation", () => {
    const restoring = reducePaywallEvent(idle, { kind: "restore_started" });
    expect(restoring).toEqual({ kind: "restoring" });
    expect(reducePaywallEvent(restoring, { kind: "restore_succeeded", entitlement: null })).toEqual(
      { entitlement: null, kind: "success" },
    );
    expect(reducePaywallEvent(idle, { kind: "purchase_cancelled" })).toEqual({ kind: "idle" });
  });
});

describe("toPaywallPresentation", () => {
  it("renders copy for each state", () => {
    expect(toPaywallPresentation({ kind: "idle" }).ctaLabel).toBe("Upgrade");
    expect(toPaywallPresentation({ kind: "purchasing", packageId: "p1" }).ctaDisabled).toBe(true);
    expect(toPaywallPresentation({ entitlement: "pro", kind: "success" }).title).toContain("Pro");
    expect(toPaywallPresentation({ kind: "failure", message: "Declined" }).message).toBe(
      "Declined",
    );
  });
});

describe("createFakePurchasesProvider", () => {
  it("lists deterministic offerings and purchases a package", async () => {
    const provider = createFakePurchasesProvider();
    const offerings = await provider.getOfferings();
    expect(offerings.length).toBeGreaterThan(0);
    expect(offerings[0]?.identifier).toBeTruthy();

    await expect(provider.purchasePackage(offerings[0]!.identifier)).resolves.toBeUndefined();
    await expect(provider.purchasePackage("not-a-package")).rejects.toThrow("Unknown package");
  });

  it("keeps the fake restore flow local and never reports an entitlement", async () => {
    const provider = createFakePurchasesProvider();
    await expect(provider.restorePurchases()).resolves.toBeUndefined();
    await provider.purchasePackage("supastack_pro_monthly");
    await expect(provider.restorePurchases()).resolves.toBeUndefined();
  });
});

describe("createRevenueCatProvider", () => {
  it("configures and switches to the server identity before each store operation", async () => {
    const events: unknown[] = [];
    const provider = (await import("./paywall")).createRevenueCatProvider(
      {
        configure: vi.fn((input) => events.push(["configure", input])),
        async getOfferings() {
          events.push("offerings");
          return {
            current: {
              availablePackages: [
                {
                  identifier: "monthly",
                  product: {
                    identifier: "pro_monthly",
                    priceString: "$9.99",
                    title: "Pro Monthly",
                  },
                },
              ],
            },
          };
        },
        logIn: vi.fn(async (appUserId: string) => events.push(["login", appUserId])),
        async purchasePackage(identifier: string) {
          events.push(["purchase", identifier]);
        },
        async restorePurchases() {
          events.push("restore");
        },
      },
      "public-key",
    );

    await expect(provider.getOfferings("ssws_workspace_a")).resolves.toEqual([
      {
        identifier: "monthly",
        priceString: "$9.99",
        productIdentifier: "pro_monthly",
        title: "Pro Monthly",
      },
    ]);
    await provider.purchasePackage("monthly", "ssws_workspace_a");
    await provider.restorePurchases("ssws_workspace_b");

    expect(events).toEqual([
      ["configure", { apiKey: "public-key", appUserId: "ssws_workspace_a" }],
      "offerings",
      ["purchase", "monthly"],
      ["login", "ssws_workspace_b"],
      "restore",
    ]);
  });

  it("normalizes store purchase cancellation without marking it as an error", async () => {
    const provider = (await import("./paywall")).createRevenueCatProvider(
      {
        configure() {},
        async getOfferings() {
          return { current: { availablePackages: [] } };
        },
        async logIn() {},
        async purchasePackage() {
          throw { userCancelled: true };
        },
        async restorePurchases() {},
      },
      "public-key",
    );

    await expect(provider.purchasePackage("monthly", "ssws_workspace_a")).rejects.toMatchObject({
      name: "PurchaseCancelledError",
    });
  });
});
