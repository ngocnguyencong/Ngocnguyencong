import { describe, expect, it, vi } from "vitest";

import type { MobileApiClient } from "../api/client";
import { createMobilePurchasesActions } from "./client";

describe("createMobilePurchasesActions", () => {
  it("validates the server-selected workspace purchase identity", async () => {
    const request = vi.fn(async () => ({
      data: {
        appUserId: "ssws_d29ya3NwYWNlLTE",
        available: true,
        entitlementId: "pro",
        workspaceId: "workspace-1",
      },
    }));
    const actions = createMobilePurchasesActions({ request } as unknown as MobileApiClient);

    await expect(actions.getStatus()).resolves.toEqual({
      appUserId: "ssws_d29ya3NwYWNlLTE",
      available: true,
      entitlementId: "pro",
      workspaceId: "workspace-1",
    });
    expect(request).toHaveBeenCalledWith("/api/mobile/purchases/sync", { method: "GET" });
  });

  it("syncs through an empty server-authoritative request body", async () => {
    const request = vi.fn(async () => ({ data: { active: true, workspaceId: "workspace-1" } }));
    const actions = createMobilePurchasesActions({ request } as unknown as MobileApiClient);

    await expect(actions.sync()).resolves.toEqual({ active: true, workspaceId: "workspace-1" });
    expect(request).toHaveBeenCalledWith("/api/mobile/purchases/sync", {
      body: {},
      method: "POST",
    });
  });

  it("rejects a server status without a workspace id", async () => {
    const request = vi.fn(async () => ({ data: { active: false } }));
    const actions = createMobilePurchasesActions({ request } as unknown as MobileApiClient);

    await expect(actions.sync()).rejects.toThrow("purchase response was invalid");
  });
});
