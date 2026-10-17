import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("landing-v2 preview route", () => {
  it("is dev-gated like /kit-blocks and composes the alternate arrangement", () => {
    const source = readFileSync(join(webRoot, "app/landing-v2/page.tsx"), "utf8");
    expect(source).toContain('process.env.NODE_ENV !== "development"');
    expect(source).toContain("notFound");
    // The alternate composition deliberately differs from the default
    // landing: split hero + feature tabs instead of centered hero + grid.
    expect(source).toContain("HeroSplit");
    expect(source).toContain("FeatureTabs");
    expect(source).not.toContain("HeroCentered");
    expect(source).not.toContain("WaitlistBand");
    // Neutral demo content only — no testimonials or trust proof.
    expect(source).not.toMatch(/testimonial|TestimonialGrid/);
    expect(source).toContain("Illustrative prices");
  });
});
