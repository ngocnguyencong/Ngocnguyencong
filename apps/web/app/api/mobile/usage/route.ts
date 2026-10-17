import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { resolveMobileWorkspaceContext } from "../../../../src/mobile-workspace-context";
import { getWorkspaceUsageOverview } from "../../../../src/usage-overview";

export const runtime = "nodejs";

/**
 * Mobile BFF twin of Settings → Usage: the current-month workspace usage
 * overview (AI spend vs budget, per-meter plan limits/caps, prepaid
 * credits), resolved through the mobile workspace context.
 */
export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const context = await resolveMobileWorkspaceContext(session.user.id);
  if (context === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const overview = await getWorkspaceUsageOverview(context.workspaceId, new Date());
  return NextResponse.json(overview, { status: 200 });
}
