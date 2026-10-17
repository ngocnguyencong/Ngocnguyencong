import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../../../src/auth-runtime";
import { appendChatMessage, resolveChatScope } from "../../../../../../src/chat-api";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../../src/request-body";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = await resolveChatScope(session.user.id, "write");
  if (scope === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }
  const { threadId } = await context.params;
  if (!threadId) {
    return NextResponse.json({ error: "Thread id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The request body is too large." }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content =
    typeof body === "object" && body !== null && "content" in body ? body.content : undefined;
  const role = typeof body === "object" && body !== null && "role" in body ? body.role : undefined;

  const result = await appendChatMessage(scope, threadId, {
    content: typeof content === "string" ? content : "",
    role: typeof role === "string" ? role : "",
  });
  if (result === "not-found") {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  if (result === "invalid") {
    return NextResponse.json({ error: "A valid role and content are required." }, { status: 400 });
  }
  return NextResponse.json({ message: result.message }, { status: 201 });
}
