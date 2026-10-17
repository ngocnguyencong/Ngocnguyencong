import type { ExistingEntitlement, ExistingEntitlementStatus } from "./presentation";

const entitlementEndpoint = "/api/mobile/entitlement";

export interface MobileEntitlementClient {
  apiUrl: string;
  getCookie: () => Promise<string | null | undefined>;
}

export interface MobileEntitlementResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

export type MobileEntitlementFetch = (
  url: string,
  init: { headers: Record<string, string>; method: "GET" },
) => Promise<MobileEntitlementResponse>;

interface MobileEntitlementPayload {
  entitlement: ExistingEntitlement | null;
  workspaceId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEntitlementStatus(value: unknown): value is ExistingEntitlementStatus {
  return value === "active" || value === "past_due" || value === "trialing";
}

function isExistingEntitlement(value: unknown): value is ExistingEntitlement {
  return (
    isRecord(value) &&
    (typeof value.expiresAt === "string" || value.expiresAt === null) &&
    typeof value.productName === "string" &&
    isEntitlementStatus(value.status) &&
    typeof value.workspaceId === "string"
  );
}

function parsePayload(value: unknown): MobileEntitlementPayload {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("The entitlement response was invalid.");
  }

  const { entitlement, workspaceId } = value.data;

  if (
    typeof workspaceId !== "string" ||
    (entitlement !== null && !isExistingEntitlement(entitlement))
  ) {
    throw new Error("The entitlement response was invalid.");
  }

  if (entitlement !== null && entitlement.workspaceId !== workspaceId) {
    throw new Error("The entitlement response did not match its workspace.");
  }

  return { entitlement, workspaceId };
}

function responseErrorMessage(value: unknown, status: number): string {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }

  return status === 401
    ? "Sign in before viewing your entitlement."
    : "Your entitlement could not be loaded.";
}

/** Creates a cookie-backed, read-only action for the fixed mobile entitlement endpoint. */
export function createMobileEntitlementActions(
  client: MobileEntitlementClient,
  request: MobileEntitlementFetch = (url, init) => fetch(url, init),
) {
  const endpoint = new URL(entitlementEndpoint, client.apiUrl).toString();

  return {
    async fetchEntitlement(): Promise<ExistingEntitlement | null> {
      const cookie = await client.getCookie();

      if (!cookie) {
        throw new Error("Your authentication session is unavailable.");
      }

      const response = await request(endpoint, {
        headers: { Accept: "application/json", Cookie: cookie },
        method: "GET",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(responseErrorMessage(payload, response.status));
      }

      return parsePayload(payload).entitlement;
    },
  };
}
