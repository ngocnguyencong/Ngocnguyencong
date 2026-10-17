import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { resolveChatScope } from "../../../../src/chat-api";
import { loadWorkspaceMetrics } from "../../../../src/workspace-metrics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = await resolveChatScope(session.user.id);
  if (scope === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  try {
    const metrics = await loadWorkspaceMetrics(scope);
    return NextResponse.json({ metrics }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Metrics unavailable" }, { status: 503 });
  }
}
