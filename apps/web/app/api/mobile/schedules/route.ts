import { NextResponse } from "next/server";

import { listWorkspaceSchedules, upsertScheduleAction } from "../../../../src/schedule-actions";

export const runtime = "nodejs";

/** Lists job schedules for the caller's active workspace. */
export async function GET() {
  const result = await listWorkspaceSchedules();
  if (result.rows === null) {
    return NextResponse.json({ error: "Owner or admin role required." }, { status: 403 });
  }
  return NextResponse.json({ rows: result.rows });
}

/** Creates or updates a workspace job schedule. */
export async function POST(request: Request) {
  let body: { cron?: unknown; enabled?: unknown; type?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const result = await upsertScheduleAction({
    cron: typeof body.cron === "string" ? body.cron : "",
    ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
    type: typeof body.type === "string" ? body.type : "",
  });
  if (result.error !== undefined) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
