import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("AI chat sample routes", () => {
  it("exposes /chat wired to the durable AI task client path", () => {
    const page = readFileSync(join(webRoot, "app/chat/page.tsx"), "utf8");
    const ui = readFileSync(join(webRoot, "src/web-chat-page.tsx"), "utf8");
    const chrome = readFileSync(join(webRoot, "src/app-chrome.tsx"), "utf8");

    expect(page).toContain("WebChatPage");
    expect(page).toContain("getReferenceMode");
    expect(ui).toContain("runChatTurn");
    expect(ui).toContain("createProductionAiClient");
    expect(ui).toContain("WorkspaceShell");
    expect(chrome).toContain('["Chat", "/chat"]');
  });

  it("mounts the AI task console at /ai instead of redirecting to /chat", () => {
    const page = readFileSync(join(webRoot, "app/ai/page.tsx"), "utf8");
    expect(page).not.toContain('redirect("/chat")');
    expect(page).toContain("getReferenceMode");
    expect(page).toContain("ReferenceApp");
    expect(page).toContain("ProductionReferenceApp");
    expect(page).toContain('export const dynamic = "force-dynamic"');
  });
});
