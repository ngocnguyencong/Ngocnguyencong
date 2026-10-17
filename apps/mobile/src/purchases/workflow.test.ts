import { describe, expect, it, vi } from "vitest";

import { syncMobilePurchaseAndRefresh } from "./workflow";

describe("syncMobilePurchaseAndRefresh", () => {
  it("returns the configured entitlement only after server verification and refresh", async () => {
    const purchases = { sync: vi.fn(async () => ({ active: true, workspaceId: "workspace-1" })) };
    const refreshEntitlement = vi.fn(async () => ({
      expiresAt: null,
      productName: "pro",
      status: "active" as const,
      workspaceId: "workspace-1",
    }));

    await expect(
      syncMobilePurchaseAndRefresh({
        entitlementId: "pro",
        expectedWorkspaceId: "workspace-1",
        purchases,
        refreshEntitlement,
      }),
    ).resolves.toBe("pro");
    expect(purchases.sync).toHaveBeenCalledTimes(1);
    expect(refreshEntitlement).toHaveBeenCalledTimes(1);
  });

  it("does not grant a client entitlement when the server says inactive", async () => {
    const refreshEntitlement = vi.fn(async () => null);

    await expect(
      syncMobilePurchaseAndRefresh({
        entitlementId: "pro",
        expectedWorkspaceId: "workspace-1",
        purchases: { sync: async () => ({ active: false, workspaceId: "workspace-1" }) },
        refreshEntitlement,
      }),
    ).resolves.toBeNull();
    expect(refreshEntitlement).toHaveBeenCalledTimes(1);
  });

  it("rejects a workspace mismatch before refreshing the entitlement", async () => {
    const refreshEntitlement = vi.fn(async () => null);

    await expect(
      syncMobilePurchaseAndRefresh({
        entitlementId: "pro",
        expectedWorkspaceId: "workspace-1",
        purchases: { sync: async () => ({ active: true, workspaceId: "workspace-2" }) },
        refreshEntitlement,
      }),
    ).rejects.toThrow("active workspace changed");
    expect(refreshEntitlement).not.toHaveBeenCalled();
  });
});
