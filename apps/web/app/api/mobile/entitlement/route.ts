import { NextResponse } from "next/server";

import { database, getAuthSession } from "../../../../src/auth-runtime";
import { resolveMobileWorkspaceContext } from "../../../../src/mobile-workspace-context";
import {
  createMobileEntitlementBff,
  type MobileEntitlementStatus,
} from "../../../../src/mobile-entitlement-bff";

const visibleEntitlementStatuses: MobileEntitlementStatus[] = ["active", "past_due", "trialing"];

const mobileEntitlementBff = createMobileEntitlementBff({
  findWorkspaceEntitlement: async (userId) => {
    const membership = await resolveMobileWorkspaceContext(userId);

    if (membership === null) {
      return null;
    }

    const [currentEntitlement] = await database.query.entitlement.findMany({
      columns: {
        expiresAt: true,
        key: true,
        status: true,
        workspaceId: true,
      },
      limit: 1,
      orderBy: (fields, { desc }) => [desc(fields.updatedAt)],
      where: (fields, { and, eq, inArray, or, isNull, gt }) =>
        and(
          eq(fields.workspaceId, membership.workspaceId),
          inArray(fields.status, visibleEntitlementStatuses),
          or(isNull(fields.expiresAt), gt(fields.expiresAt, new Date())),
        ),
    });

    return {
      entitlement:
        currentEntitlement === undefined
          ? null
          : {
              expiresAt: currentEntitlement.expiresAt?.toISOString() ?? null,
              productName: currentEntitlement.key,
              status: toMobileEntitlementStatus(currentEntitlement.status),
              workspaceId: currentEntitlement.workspaceId,
            },
      workspaceId: membership.workspaceId,
    };
  },
  getSession: async (headers) => {
    return getAuthSession(headers);
  },
});

function toMobileEntitlementStatus(status: string): MobileEntitlementStatus {
  if (status === "active" || status === "past_due" || status === "trialing") {
    return status;
  }

  throw new Error("The stored entitlement status is not visible on mobile.");
}

export async function GET(request: Request) {
  const response = await mobileEntitlementBff.get(request.headers);

  return NextResponse.json(response.body, { status: response.status });
}
