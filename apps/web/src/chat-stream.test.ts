import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("chat streaming endpoint", () => {
  it("serves an SSE stream that keeps session, workspace scope, and capability routing", () => {
    const route = readWeb("app/api/chat/stream/route.ts");
    expect(route).toContain("ReadableStream");
    expect(route).toContain("text/event-stream");
    expect(route).toContain("getAuthSession");
    expect(route).toContain("status: 401");
    expect(route).toContain("resolveChatScope");
    expect(route).toContain("streamChatReply");
  });

  it("runs completions through the shared router so budgets and capabilities still apply", () => {
    const runtime = readWeb("src/chat-stream-runtime.ts");
    expect(runtime).toContain('import "server-only"');
    expect(runtime).toContain("completeChat(");
    expect(runtime).toContain("aiTaskUserLimiter");
    expect(runtime).toContain("aiTaskWorkspaceLimiter");
    const composition = readWeb("src/ai-task-runtime.ts");
    expect(composition).toContain("completeBudgetedChat(");
    expect(composition).toContain("resolveWorkspaceAiContext");
    expect(runtime).toContain("appendChatMessage");
    expect(runtime).toContain("WorkspaceBudgetExceededError");
    expect(runtime).toContain("NoEligibleModelError");
  });

  it("persists the user prompt before streaming and the reply after completion", () => {
    const runtime = readWeb("src/chat-stream-runtime.ts");
    const userAppend = runtime.indexOf('role: "user"');
    const complete = runtime.indexOf("completeChat(");
    const assistantAppend = runtime.indexOf('role: "assistant"');
    expect(userAppend).toBeGreaterThanOrEqual(0);
    expect(complete).toBeGreaterThan(userAppend);
    expect(assistantAppend).toBeGreaterThan(complete);
  });

  it("emits chunk, done, and error SSE events", () => {
    const runtime = readWeb("src/chat-stream-runtime.ts");
    expect(runtime).toContain('type: "chunk"');
    expect(runtime).toContain('type: "done"');
    expect(runtime).toContain('type: "error"');
  });

  it("lets the chat page stream replies incrementally with a durable fallback", () => {
    const page = readWeb("src/web-chat-page.tsx");
    expect(page).toContain("/api/chat/stream");
    expect(page).toContain("getReader");
    expect(page).toContain("TextDecoder");
    expect(page).toContain("streamReply");
    expect(page).toContain("aria-live");
  });
});
