import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { marketingStaticPaths } from "./marketing/marketing-sitemap";
import robots from "../app/robots";

describe("robots.txt", () => {
  it("disallows app/authenticated surfaces including /setup", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const entries = Array.isArray(rule?.disallow) ? rule.disallow : [rule?.disallow];
    for (const prefix of ["/setup", "/admin", "/settings", "/billing", "/api/"]) {
      expect(entries, prefix).toContain(prefix);
    }
    // /setup is a canonical-only utility route — there is no localized
    // mirror, so only the bare prefix needs disallowing.
    expect(JSON.stringify(robots())).not.toContain("/*/setup");
  });
});

describe("/setup stays out of public discovery surfaces", () => {
  it("is absent from the marketing sitemap entries", () => {
    expect(JSON.stringify(marketingStaticPaths)).not.toContain('"/setup"');
  });
});
