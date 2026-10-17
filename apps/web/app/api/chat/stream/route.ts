import type { ModelRequirements } from "@supastack/ai";
import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { resolveChatScope } from "../../../../src/chat-api";
import { streamChatReply } from "../../../../src/chat-stream-runtime";

export const runtime = "nodejs";

const MAX_PROMPT_CHARS = 8000;
const ALIASES = new Set(["fast", "smart", "cheap"]);

export async function POST(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = await resolveChatScope(session.user.id, "write");
  if (scope === null) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const record = typeof body === "object" && body !== null ? body : {};
  const prompt = "prompt" in record && typeof record.prompt === "string" ? record.prompt : "";
  const threadId =
    "threadId" in record && typeof record.threadId === "string" ? record.threadId : undefined;
  const alias =
    "alias" in record && typeof record.alias === "string" && ALIASES.has(record.alias)
      ? (record.alias as "cheap" | "fast" | "smart")
      : "fast";

  if (prompt.trim().length === 0 || prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: "A prompt between 1 and 8000 characters is required." },
      { status: 400 },
    );
  }

  const requirements = sanitizeRequirements(
    "requirements" in record ? record.requirements : undefined,
  );

  const stream: ReadableStream<Uint8Array> = streamChatReply(scope, {
    alias,
    prompt,
    requirements,
    signal: request.signal,
    threadId,
  });
  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
    status: 200,
  });
}

function sanitizeRequirements(value: unknown): ModelRequirements {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return {
    ...("minContext" in value && typeof value.minContext === "number" && value.minContext > 0
      ? { minContext: Math.floor(value.minContext) }
      : {}),
    ...("structuredOutput" in value && typeof value.structuredOutput === "boolean"
      ? { structuredOutput: value.structuredOutput }
      : {}),
    ...("tools" in value && typeof value.tools === "boolean" ? { tools: value.tools } : {}),
    ...("vision" in value && typeof value.vision === "boolean" ? { vision: value.vision } : {}),
  };
}
