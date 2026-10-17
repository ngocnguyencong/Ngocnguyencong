import { resolveActiveWorkspaceId } from "@supastack/db";

import { ACTIVE_WORKSPACE_COOKIE } from "./organization-constants";

export type ActiveWorkspaceMembership = Readonly<{
  role: string;
  workspaceId: string;
  workspaceType: "organization" | "personal";
}>;

export function readActiveWorkspaceCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator);
    if (name !== ACTIVE_WORKSPACE_COOKIE) continue;
    const value = decodeURIComponent(part.slice(separator + 1));
    return value.length > 0 ? value : null;
  }
  return null;
}

export function resolveBillingWorkspaceId(input: {
  cookieWorkspaceId: string | null | undefined;
  preferredWorkspaceId: string | null | undefined;
  memberships: readonly ActiveWorkspaceMembership[];
}): string | null {
  if (input.memberships.length === 0) {
    return null;
  }

  const membershipIds = input.memberships.map((membership) => membership.workspaceId);
  const personalWorkspaceId =
    input.memberships.find((membership) => membership.workspaceType === "personal")?.workspaceId ??
    membershipIds[0]!;

  const candidates = [input.cookieWorkspaceId, input.preferredWorkspaceId];
  for (const candidate of candidates) {
    if (candidate && membershipIds.includes(candidate)) {
      return candidate;
    }
  }

  return resolveActiveWorkspaceId({
    activeWorkspaceId: null,
    membershipWorkspaceIds: membershipIds,
    personalWorkspaceId,
  });
}
