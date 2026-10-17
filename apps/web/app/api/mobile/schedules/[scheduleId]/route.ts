import { NextResponse } from "next/server";

import { removeScheduleAction } from "../../../../../src/schedule-actions";
import { requireWorkspaceManager } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

/** Removes a workspace job schedule (owner/admin only). */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ scheduleId: string }> },
) {
  const manager = await requireWorkspaceManager();
  if ("error" in manager) {
    return NextResponse.json(
      { error: manager.error },
      { status: manager.error === "Sign in required." ? 401 : 403 },
    );
  }
  const { scheduleId } = await context.params;
  const formData = new FormData();
  formData.set("scheduleId", scheduleId);
  await removeScheduleAction(formData);
  return NextResponse.json({ ok: true });
}
