import {
  AUDIT_ACTIONS,
  canManageWorkspaceMembers,
  normalizeWorkspaceRole,
  workspaceMembership,
} from "@supastack/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { recordAuditEvent } from "../../../../src/audit-runtime";
import { database, getAuthSession } from "../../../../src/auth-runtime";
import { resolveActiveWorkspaceIdForSessionUser } from "../../../../src/organization-actions";
import { rateLimitResponse } from "../../../../src/rate-limit-route";
import { exportDownloadLimiter } from "../../../../src/rate-limit-runtime";
import { buildWorkspaceExport } from "../../../../src/workspace-export";

/**
 * Downloads a full JSON export of the caller's active workspace. Session →
 * active workspace → owner/admin membership, the same gate the usage-limit
 * actions use.
 */
export async function GET() {
  const requestHeaders = await headers();
  const session = await getAuthSession(requestHeaders);
  if (session === null) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication is required." } },
      { status: 401 },
    );
  }
  const workspaceId = await resolveActiveWorkspaceIdForSessionUser(session.user.id);
  if (workspaceId === undefined) {
    return Response.json(
      { error: { code: "forbidden", message: "An owner or admin role is required." } },
      { status: 403 },
    );
  }
  const [membership] = await database
    .select({ role: workspaceMembership.role })
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.workspaceId, workspaceId),
        eq(workspaceMembership.userId, session.user.id),
      ),
    )
    .limit(1);
  if (
    membership === undefined ||
    !canManageWorkspaceMembers(normalizeWorkspaceRole(membership.role))
  ) {
    return Response.json(
      { error: { code: "forbidden", message: "An owner or admin role is required." } },
      { status: 403 },
    );
  }

  const limited = await rateLimitResponse(
    requestHeaders,
    exportDownloadLimiter,
    "workspace-export",
  );
  if (limited !== null) {
    return limited;
  }

  const data = await buildWorkspaceExport(workspaceId, new Date());
  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceDataExported,
    actorUserId: session.user.id,
    targetId: workspaceId,
    targetType: "workspace",
    workspaceId,
  });
  const slug = String(data.workspace?.slug ?? "workspace").replace(/[^a-zA-Z0-9_-]/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="workspace-export-${slug}-${date}.json"`,
      "content-type": "application/json; charset=utf-8",
    },
    status: 200,
  });
}
