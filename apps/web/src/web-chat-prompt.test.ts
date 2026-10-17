import { describe, expect, it } from "vitest";

import { buildChatTaskPrompt, type ChatMessage } from "./web-chat-prompt.js";

describe("buildChatTaskPrompt", () => {
  it("serializes a multi-turn transcript with role labels", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "What is supastack?" },
      { role: "assistant", content: "A modular SaaS foundation." },
      { role: "user", content: "Who owns AI usage?" },
    ];

    const prompt = buildChatTaskPrompt(messages);

    expect(prompt).toContain("User: What is supastack?");
    expect(prompt).toContain("Assistant: A modular SaaS foundation.");
    expect(prompt).toContain("User: Who owns AI usage?");
    expect(prompt.trim().endsWith("Assistant:")).toBe(true);
  });

  it("appends a structured JSON instruction when requested", () => {
    const prompt = buildChatTaskPrompt([{ role: "user", content: "List two capabilities." }], {
      structuredOutput: true,
    });

    expect(prompt).toMatch(/json/i);
    expect(prompt).toContain("List two capabilities.");
  });

  it("rejects an empty transcript", () => {
    expect(() => buildChatTaskPrompt([])).toThrow(/message/i);
  });
});
