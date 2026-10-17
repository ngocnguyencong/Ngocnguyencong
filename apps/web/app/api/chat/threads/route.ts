import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { createChatThread, listChatThreads, resolveChatScope } from "../../../../src/chat-api";

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
  return NextResponse.json({ threads: await listChatThreads(scope) }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = await resolveChatScope(session.user.id, "write");
  if (scope === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const title =
    typeof body === "object" && body !== null && "title" in body && typeof body.title === "string"
      ? body.title
      : undefined;

  const thread = await createChatThread(scope, title);
  return NextResponse.json({ thread }, { status: 201 });
}
