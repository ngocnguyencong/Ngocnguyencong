export type ExistingEntitlementStatus = "active" | "past_due" | "trialing";

export interface ExistingEntitlement {
  expiresAt: string | null;
  productName: string;
  status: ExistingEntitlementStatus;
  workspaceId: string;
}

export interface EntitlementPresentation {
  detail: string;
  status: "Active" | "No active entitlement" | "Past due" | "Trial";
  title: string;
  workspaceId: string | null;
}

function formatExpiration(expiresAt: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(expiresAt));
}

export function toEntitlementPresentation(
  entitlement: ExistingEntitlement | null,
): EntitlementPresentation {
  if (entitlement === null) {
    return {
      detail: "No server-verified entitlement is active for this workspace.",
      status: "No active entitlement",
      title: "supastack",
      workspaceId: null,
    };
  }

  const status =
    entitlement.status === "active"
      ? "Active"
      : entitlement.status === "trialing"
        ? "Trial"
        : "Past due";
  const detail = entitlement.expiresAt
    ? `Server-verified access. Recorded expiration date: ${formatExpiration(
        entitlement.expiresAt,
      )}.`
    : "Server-verified access. No expiration date is recorded.";

  return {
    detail,
    status,
    title: entitlement.productName,
    workspaceId: entitlement.workspaceId,
  };
}
