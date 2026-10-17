import type { MobileApiClient } from "../api/client";

export interface MobilePurchaseStatus {
  appUserId: string | null;
  available: boolean;
  entitlementId: string | null;
  workspaceId: string;
}

export interface MobilePurchaseSync {
  active: boolean;
  workspaceId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): MobilePurchaseStatus {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("The purchase response was invalid.");
  }
  const { appUserId, available, entitlementId, workspaceId } = value.data;
  if (
    typeof available !== "boolean" ||
    typeof workspaceId !== "string" ||
    (appUserId !== null && typeof appUserId !== "string") ||
    (entitlementId !== null && typeof entitlementId !== "string") ||
    (available && (typeof appUserId !== "string" || typeof entitlementId !== "string")) ||
    (!available && (appUserId !== null || entitlementId !== null))
  ) {
    throw new Error("The purchase response was invalid.");
  }
  return { appUserId, available, entitlementId, workspaceId };
}

function parseSync(value: unknown): MobilePurchaseSync {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    typeof value.data.active !== "boolean" ||
    typeof value.data.workspaceId !== "string"
  ) {
    throw new Error("The purchase response was invalid.");
  }
  return { active: value.data.active, workspaceId: value.data.workspaceId };
}

/** Server-scoped RevenueCat configuration and authoritative purchase sync. */
export function createMobilePurchasesActions(api: MobileApiClient) {
  return {
    async getStatus(): Promise<MobilePurchaseStatus> {
      return parseStatus(
        await api.request<unknown>("/api/mobile/purchases/sync", { method: "GET" }),
      );
    },
    async sync(): Promise<MobilePurchaseSync> {
      return parseSync(
        await api.request<unknown>("/api/mobile/purchases/sync", {
          body: {},
          method: "POST",
        }),
      );
    },
  };
}
