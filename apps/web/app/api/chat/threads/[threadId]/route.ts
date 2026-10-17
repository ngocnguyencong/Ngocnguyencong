import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../../src/auth-runtime";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../src/request-body";
import {
  deleteChatThread,
  listChatMessages,
  renameChatThread,
  resolveChatScope,
} from "../../../../../src/chat-api";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ threadId: string }> };

async function resolveScopedThread(
  request: Request,
  context: RouteContext,
  access: "read" | "write" = "read",
) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const scope = await resolveChatScope(session.user.id, access);
  if (scope === null) {
    return { error: NextResponse.json({ error: "No workspace" }, { status: 403 }) };
  }
  const { threadId } = await context.params;
  if (!threadId) {
    return { error: NextResponse.json({ error: "Thread id required" }, { status: 400 }) };
  }
  return { scope, threadId };
}

export async function GET(request: Request, context: RouteContext) {
  const resolved = await resolveScopedThread(request, context);
  if ("error" in resolved) {
    return resolved.error;
  }
  const messages = await listChatMessages(resolved.scope, resolved.threadId);
  if (messages === null) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json({ messages }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const resolved = await resolveScopedThread(request, context, "write");
  if ("error" in resolved) {
    return resolved.error;
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
  const title =
    typeof body === "object" && body !== null && "title" in body && typeof body.title === "string"
      ? body.title
      : "";
  const result = await renameChatThread(resolved.scope, resolved.threadId, title);
  if (result === "invalid") {
    return NextResponse.json({ error: "A non-empty title is required." }, { status: 400 });
  }
  if (result === "not-found") {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const resolved = await resolveScopedThread(request, context, "write");
  if ("error" in resolved) {
    return resolved.error;
  }
  const result = await deleteChatThread(resolved.scope, resolved.threadId);
  if (result === "not-found") {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
