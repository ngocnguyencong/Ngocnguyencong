import { AUDIT_ACTIONS } from "@supastack/db";
import { headers } from "next/headers";

import { recordAuditEvent } from "../../../../src/audit-runtime";
import { getAuthSession } from "../../../../src/auth-runtime";
import { buildUserDataExport } from "../../../../src/data-export";

/** Downloads the signed-in user's personal data export as JSON. */
export async function GET() {
  const session = await getAuthSession(await headers());
  if (session === null) {
    return Response.json(
      { error: { code: "unauthorized", message: "Authentication is required." } },
      { status: 401 },
    );
  }
  const data = await buildUserDataExport(session.user.id);
  await recordAuditEvent({
    action: AUDIT_ACTIONS.workspaceExportDownloaded,
    actorUserId: session.user.id,
    targetId: session.user.id,
    targetType: "user",
  });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-disposition": `attachment; filename="supastack-data-export-${session.user.id}.json"`,
      "content-type": "application/json; charset=utf-8",
    },
    status: 200,
  });
}
