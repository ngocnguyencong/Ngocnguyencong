import { describe, expect, it } from "vitest";

import type { ProductPlan } from "./product-plans";
import { USAGE_METERS, usageMeters } from "./usage-meters";

function plan(overrides: Partial<ProductPlan> & Pick<ProductPlan, "id">): ProductPlan {
  return Object.freeze({
    blurb: "",
    checkout: "none",
    entitlement: null,
    interval: "none",
    name: overrides.id,
    priceLabel: "$0",
    seatsIncluded: 1,
    trialDays: null,
    ...overrides,
  });
}

describe("usageMeters", () => {
  it("always includes the shipped ai.requests meter first", () => {
    expect(USAGE_METERS[0]).toEqual({
      key: "ai.requests",
      label: "AI requests",
      description: "AI tasks started in this workspace.",
    });
  });

  it("extends the catalog with meter keys declared by product plans", () => {
    const meters = usageMeters([
      plan({ id: "free", usageLimits: { "ai.requests": 25, "exports.csv": 10 } }),
      plan({ id: "pro", usageLimits: { "exports.csv": 100, "reports.pdf": 5 } }),
    ]);
    expect(meters.map((meter) => meter.key)).toEqual(["ai.requests", "exports.csv", "reports.pdf"]);
    // Plan-declared keys fall back to the key as the label.
    expect(meters[1]).toMatchObject({ key: "exports.csv", label: "exports.csv" });
  });

  it("dedupes keys shared across plans and ignores plans without limits", () => {
    const meters = usageMeters([
      plan({ id: "free" }),
      plan({ id: "pro", usageLimits: { "ai.requests": 500 } }),
      plan({ id: "enterprise", usageLimits: { "ai.requests": 5000 } }),
    ]);
    expect(meters.map((meter) => meter.key)).toEqual(["ai.requests"]);
  });
});
