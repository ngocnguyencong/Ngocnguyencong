import { describe, expect, test } from "vitest";

import { createMobileApiClient, type MobileApiFetch } from "../api/client";
import {
  createMobileChatActions,
  createSseParser,
  normalizedThreadTitle,
  removeThreadFromList,
  renameThreadInList,
  threadListTitle,
  type ChatStreamEvent,
  type ChatThreadSummary,
} from "./client";

function makeApi(routes: Record<string, unknown>, seen?: SeenRequest[]) {
  const transport: MobileApiFetch = async (url, init) => {
    const path = new URL(url).pathname + new URL(url).search;
    seen?.push({
      ...(init.body === undefined ? {} : { body: init.body }),
      method: init.method,
      path,
    });
    const payload = routes[path];
    if (payload === undefined) {
      return { json: async () => ({ error: "Not found" }), ok: false, status: 404 };
    }
    return { json: async () => payload, ok: true, status: 200 };
  };
  return createMobileApiClient(
    { apiUrl: "https://api.example.test", getCookie: async () => "c=1" },
    transport,
  );
}

interface SeenRequest {
  body?: string;
  method: string;
  path: string;
}

describe("createSseParser", () => {
  test("emits chunk events for complete data frames", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));
    parser.push('data:{"type":"chunk","text":"Hel"}\n\ndata:{"type":"chunk","text":"lo"}\n\n');
    expect(events).toEqual([
      { text: "Hel", type: "chunk" },
      { text: "lo", type: "chunk" },
    ]);
  });

  test("buffers partial frames across pushes", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));
    parser.push('data:{"type":"chu');
    parser.push('nk","text":"hi"}\n\nda');
    parser.push('ta:{"type":"done","model":"gpt-x"}\n\n');
    expect(events).toEqual([
      { text: "hi", type: "chunk" },
      { model: "gpt-x", type: "done" },
    ]);
  });

  test("emits error events and skips malformed JSON", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));
    parser.push('data:{oops\n\ndata:{"type":"error","message":"quota"}\n\n');
    expect(events).toEqual([{ message: "quota", type: "error" }]);
  });

  test("ignores comment and event lines", () => {
    const events: ChatStreamEvent[] = [];
    const parser = createSseParser((event) => events.push(event));
    parser.push(':keep-alive\n\nevent: ping\n\ndata:{"type":"chunk","text":"a"}\n\n');
    expect(events).toEqual([{ text: "a", type: "chunk" }]);
  });
});

describe("createMobileChatActions", () => {
  test("renameThread PATCHes the thread title", async () => {
    const seen: SeenRequest[] = [];
    const chat = createMobileChatActions(makeApi({ "/api/chat/threads/t1": { ok: true } }, seen));
    await chat.renameThread("t1", "Release notes");
    expect(seen[0]?.method).toBe("PATCH");
    expect(seen[0]?.path).toBe("/api/chat/threads/t1");
    expect(JSON.parse(seen[0]?.body ?? "{}")).toEqual({ title: "Release notes" });
  });

  test("renameThread encodes the thread id", async () => {
    const seen: SeenRequest[] = [];
    const chat = createMobileChatActions(
      makeApi({ "/api/chat/threads/t%201": { ok: true } }, seen),
    );
    await chat.renameThread("t 1", "x");
    expect(seen[0]?.path).toBe("/api/chat/threads/t%201");
  });

  test("deleteThread issues a DELETE for the thread", async () => {
    const seen: SeenRequest[] = [];
    const chat = createMobileChatActions(makeApi({ "/api/chat/threads/t1": { ok: true } }, seen));
    await chat.deleteThread("t1");
    expect(seen[0]).toEqual({ method: "DELETE", path: "/api/chat/threads/t1" });
  });
});

describe("thread list helpers", () => {
  const threads: ChatThreadSummary[] = [
    {
      createdAt: "2026-10-01T00:00:00.000Z",
      id: "t1",
      title: "First",
      updatedAt: "2026-10-02T00:00:00.000Z",
    },
    {
      createdAt: "2026-10-01T00:00:00.000Z",
      id: "t2",
      title: "",
      updatedAt: "2026-10-03T00:00:00.000Z",
    },
  ];

  test("threadListTitle falls back for blank titles", () => {
    expect(threadListTitle("Release notes")).toBe("Release notes");
    expect(threadListTitle("")).toBe("Untitled thread");
    expect(threadListTitle("   ")).toBe("Untitled thread");
  });

  test("normalizedThreadTitle trims and rejects empty input", () => {
    expect(normalizedThreadTitle("  Release notes  ")).toBe("Release notes");
    expect(normalizedThreadTitle("")).toBeNull();
    expect(normalizedThreadTitle("   ")).toBeNull();
  });

  test("normalizedThreadTitle matches the server's whitespace and length rules", () => {
    expect(normalizedThreadTitle("a   b\tc")).toBe("a b c");
    expect(normalizedThreadTitle("x".repeat(121))).toBe("x".repeat(120));
  });

  test("renameThreadInList retitles only the target and keeps order", () => {
    const next = renameThreadInList(threads, "t2", "Renamed");
    expect(next.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(next[0]?.title).toBe("First");
    expect(next[1]?.title).toBe("Renamed");
    expect(threads[1]?.title).toBe("");
  });

  test("removeThreadFromList drops only the target", () => {
    const next = removeThreadFromList(threads, "t1");
    expect(next.map((t) => t.id)).toEqual(["t2"]);
    expect(threads).toHaveLength(2);
  });
});
