import { describe, expect, it } from "vitest";
import { hasShowcaseEntries, showcaseEntries } from "./showcase-entries";

describe("showcaseEntries", () => {
  it("stays empty until a real product opts in", () => {
    expect(showcaseEntries).toEqual([]);
    expect(hasShowcaseEntries(showcaseEntries)).toBe(false);
    expect(JSON.stringify(showcaseEntries)).not.toMatch(/logo|testimonial|trusted by/i);
  });
});
