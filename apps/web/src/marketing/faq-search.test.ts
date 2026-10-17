import { describe, expect, it } from "vitest";
import { filterFaqItems } from "./faq-search";
import { siteConfig } from "./site-config";

describe("filterFaqItems", () => {
  it("returns every question when the query is blank", () => {
    expect(filterFaqItems(siteConfig.faq, "   ")).toEqual([...siteConfig.faq]);
  });

  it("matches question or answer text without regard to case", () => {
    const mobile = filterFaqItems(siteConfig.faq, "MOBILE");
    expect(mobile.map((item) => item.question)).toEqual([
      "Which apps are included?",
      "How do I add payments to the mobile app?",
    ]);

    const revenuecat = filterFaqItems(siteConfig.faq, "revenuecat");
    expect(revenuecat.map((item) => item.question)).toContain(
      "How do I add payments to the mobile app?",
    );

    const stripe = filterFaqItems(siteConfig.faq, "stripe");
    expect(stripe.map((item) => item.question)).toEqual(["Are these actual subscription offers?"]);
  });

  it("returns nothing for a query that matches no copy", () => {
    expect(filterFaqItems(siteConfig.faq, "zzzzzz")).toEqual([]);
  });
});
