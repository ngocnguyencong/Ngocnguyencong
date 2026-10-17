import { describe, expect, it } from "vitest";

import { clampSeatCount, parseSeatInput, sanitizeSeatInput } from "./seat-count";

describe("sanitizeSeatInput", () => {
  it("strips non-digit characters", () => {
    expect(sanitizeSeatInput("1a2b")).toBe("12");
    expect(sanitizeSeatInput("abc")).toBe("");
    expect(sanitizeSeatInput("  50 ")).toBe("50");
    expect(sanitizeSeatInput("3.5")).toBe("35");
  });
});

describe("parseSeatInput", () => {
  it("rejects empty and non-digit drafts", () => {
    expect(parseSeatInput("")).toBeNull();
    expect(parseSeatInput("abc")).toBeNull();
    expect(parseSeatInput("1.5")).toBeNull();
    expect(parseSeatInput("-3")).toBeNull();
  });

  it("rejects counts below one seat", () => {
    expect(parseSeatInput("0")).toBeNull();
    expect(parseSeatInput("00")).toBeNull();
  });

  it("parses positive seat counts", () => {
    expect(parseSeatInput("1")).toBe(1);
    expect(parseSeatInput("50")).toBe(50);
    expect(parseSeatInput("007")).toBe(7);
  });
});

describe("clampSeatCount", () => {
  it("keeps counts inside the inclusive bounds", () => {
    expect(clampSeatCount(5, 999)).toBe(5);
    expect(clampSeatCount(0, 999)).toBe(1);
    expect(clampSeatCount(1200, 999)).toBe(999);
  });
});
