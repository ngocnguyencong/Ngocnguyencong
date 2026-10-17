import { NextResponse } from "next/server";

import { listWorkspaceAuditEvents } from "../../../../src/audit-runtime";

export const runtime = "nodejs";

/** Recent audit events for the caller's active workspace (owner/admin only). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const result = await listWorkspaceAuditEvents(
    Number.isFinite(limitParam) ? limitParam : undefined,
  );
  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ rows: result.rows });
}
