import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const dbRoot = join(webRoot, "..", "..", "packages", "db");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("persisted chat threads", () => {
  it("defines workspace-scoped chat_thread and chat_message tables", () => {
    const schema = readFileSync(join(dbRoot, "src", "schema.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(schema).toContain('pgTable(\n  "chat_thread"');
    expect(schema).toContain('pgTable(\n  "chat_message"');
    expect(schema).toMatch(/chat_thread[\s\S]*workspace_id[\s\S]*user_id/);
    expect(schema).toMatch(/chat_message[\s\S]*thread_id[\s\S]*role[\s\S]*content/);
  });

  it("ships a migration that creates both tables", () => {
    const journal = JSON.parse(
      readFileSync(join(dbRoot, "drizzle", "meta", "_journal.json"), "utf8"),
    ) as { entries: { idx: number; tag: string }[] };
    const sql = journal.entries
      .map((item) => {
        const sqlPath = join(dbRoot, "drizzle", `${item.tag}.sql`);
        return existsSync(sqlPath) ? readFileSync(sqlPath, "utf8") : "";
      })
      .join("\n");
    expect(sql).toContain('CREATE TABLE "chat_thread"');
    expect(sql).toContain('CREATE TABLE "chat_message"');
    expect(sql).toContain('"workspace_id" text NOT NULL');
    expect(sql).toContain('REFERENCES "public"."workspace"("id") ON DELETE cascade');
  });

  it("exposes a server service that verifies membership before touching threads", () => {
    const api = readWeb("src/chat-api.ts");
    expect(api).toContain('import "server-only"');
    expect(api).toContain("workspaceMembership");
    expect(api).toContain("listChatThreads");
    expect(api).toContain("createChatThread");
    expect(api).toContain("listChatMessages");
    expect(api).toContain("renameChatThread");
    expect(api).toContain("deleteChatThread");
    expect(api).toContain("appendChatMessage");
  });

  it("serves thread collection and item routes with auth checks", () => {
    const collection = readWeb("app/api/chat/threads/route.ts");
    expect(collection).toContain("getAuthSession");
    expect(collection).toContain("status: 401");
    expect(collection).toContain("export async function GET");
    expect(collection).toContain("export async function POST");

    const item = readWeb("app/api/chat/threads/[threadId]/route.ts");
    expect(item).toContain("export async function GET");
    expect(item).toContain("export async function PATCH");
    expect(item).toContain("export async function DELETE");
    expect(item).toContain("status: 404");

    const messages = readWeb("app/api/chat/threads/[threadId]/messages/route.ts");
    expect(messages).toContain("export async function POST");
    expect(messages).toContain("appendChatMessage");
  });

  it("renders a keyboard-accessible thread sidebar with grouping and actions", () => {
    const sidebar = readWeb("src/chat-threads-sidebar.tsx");
    expect(sidebar).toContain('"use client"');
    expect(sidebar).toContain("/api/chat/threads");
    expect(sidebar).toContain("chat-thread-list");
    expect(sidebar).toContain("New chat");
    expect(sidebar).toContain("Today");
    expect(sidebar).toContain("Yesterday");
    expect(sidebar).toContain("aria-current");
  });

  it("persists turns from the chat page and mounts the sidebar", () => {
    const page = readWeb("src/web-chat-page.tsx");
    expect(page).toContain("ChatThreadsSidebar");
    expect(page).toContain("activeThreadId");
    expect(page).toContain("appendChatTurn");
  });

  it("styles the thread sidebar with app theme tokens", () => {
    const css = readWeb("app/app-theme.css");
    expect(css).toContain(".chat-layout");
    expect(css).toContain(".chat-thread-list");
    expect(css).toMatch(/\.chat-thread-item-active\s*\{[^}]*var\(--accent\)/s);
  });
});
