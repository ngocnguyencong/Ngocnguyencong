import { describe, expect, it } from "vitest";

import { isCurrentChatRequest } from "./request-state";

describe("isCurrentChatRequest", () => {
  it("accepts updates only from the current request controller", () => {
    const current = new AbortController();
    const stale = new AbortController();

    expect(isCurrentChatRequest(current, current)).toBe(true);
    expect(isCurrentChatRequest(current, stale)).toBe(false);
    expect(isCurrentChatRequest(null, stale)).toBe(false);
  });

  it("keeps a manually stopped request current until its handler finishes", () => {
    const current = new AbortController();
    current.abort();

    expect(isCurrentChatRequest(current, current)).toBe(true);
  });
});
