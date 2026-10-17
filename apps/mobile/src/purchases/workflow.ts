import type { ExistingEntitlement } from "../entitlements/presentation";
import type { MobilePurchaseSync } from "./client";

/** Trusts the server sync result and refreshes only the server entitlement view. */
export async function syncMobilePurchaseAndRefresh(input: {
  entitlementId: string;
  expectedWorkspaceId: string;
  purchases: { sync(): Promise<MobilePurchaseSync> };
  refreshEntitlement(): Promise<ExistingEntitlement | null>;
}): Promise<string | null> {
  const result = await input.purchases.sync();
  if (result.workspaceId !== input.expectedWorkspaceId) {
    throw new Error("The active workspace changed. Switch back and restore the purchase there.");
  }

  const entitlement = await input.refreshEntitlement();
  if (entitlement !== null && entitlement.workspaceId !== result.workspaceId) {
    throw new Error("The refreshed entitlement belongs to a different workspace.");
  }

  return result.active ? input.entitlementId : null;
}
