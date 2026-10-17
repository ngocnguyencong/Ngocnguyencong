import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { workspaceMembership } from "@supastack/db";
import { assertWorkspaceObjectKey } from "@supastack/storage";

import { database, getAuthSession } from "../../../../src/auth-runtime";
import { createServerObjectStorage } from "../../../../src/storage-runtime";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId");
  const key = url.searchParams.get("key");
  if (!workspaceId || !key) {
    return NextResponse.json({ error: "workspaceId and key are required" }, { status: 400 });
  }

  try {
    assertWorkspaceObjectKey(workspaceId, key);
  } catch {
    return NextResponse.json({ error: "Invalid object key" }, { status: 400 });
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
  if (membership === undefined) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storage = createServerObjectStorage();
  const object = await storage.getObject({ workspaceId, key });
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(object.body), {
    status: 200,
    headers: {
      "content-type": object.contentType,
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}
