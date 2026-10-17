import { NextResponse } from "next/server";

import { getAuthSession } from "../../../src/auth-runtime";
import { ACTIVE_WORKSPACE_COOKIE } from "../../../src/organization-constants";
import { listWorkspacesForRequest, switchWorkspaceForRequest } from "../../../src/workspace-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listWorkspacesForRequest(session.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      activeWorkspaceId: result.activeWorkspaceId,
      memberships: result.memberships,
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workspaceId =
    typeof body === "object" && body !== null && "workspaceId" in body ? body.workspaceId : "";
  if (typeof workspaceId !== "string" || !workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const result = await switchWorkspaceForRequest(request.headers, workspaceId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: result.status },
    );
  }

  const response = NextResponse.json({ ok: true, workspaceId: result.workspaceId });
  response.cookies.set(ACTIVE_WORKSPACE_COOKIE, result.workspaceId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
