import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMMERCE_ORDER_STATUSES,
  computeOrderTotalCents,
  evaluateOrderStatusChange,
  formatCents,
  isCommerceOrderStatus,
  isCommerceProductStatus,
  normalizeCommerceProductInput,
  normalizeCurrency,
  normalizeCustomerEmail,
  normalizeOrderItems,
  parsePriceCents,
} from "./commerce";

describe("parsePriceCents", () => {
  it("parses decimal prices into integer cents", () => {
    expect(parsePriceCents("12.99")).toBe(1299);
    expect(parsePriceCents("12")).toBe(1200);
    expect(parsePriceCents("0.5")).toBe(50);
    expect(parsePriceCents("$9.99")).toBe(999);
    expect(parsePriceCents(" 7.20 ")).toBe(720);
  });

  it("rejects negative, over-precise, non-numeric, and huge prices", () => {
    expect(parsePriceCents("-1")).toBeNull();
    expect(parsePriceCents("1.999")).toBeNull();
    expect(parsePriceCents("abc")).toBeNull();
    expect(parsePriceCents("")).toBeNull();
    expect(parsePriceCents("9999999999")).toBeNull();
  });
});

describe("normalizeCurrency", () => {
  it("lowercases valid ISO-style codes and rejects others", () => {
    expect(normalizeCurrency("USD")).toBe("usd");
    expect(normalizeCurrency("eur")).toBe("eur");
    expect(normalizeCurrency("")).toBeNull();
    expect(normalizeCurrency("USDD")).toBeNull();
    expect(normalizeCurrency("u1d")).toBeNull();
  });
});

describe("normalizeCommerceProductInput", () => {
  it("trims, slugifies, and normalizes the price/currency", () => {
    const result = normalizeCommerceProductInput({
      currency: "EUR",
      description: "  A thing  ",
      imageUrl: " https://example.com/x.png ",
      inventory: "25",
      name: "  Desk Mat ",
      price: "19.90",
      slug: "",
    });
    expect(result).toEqual({
      currency: "eur",
      description: "A thing",
      imageUrl: "https://example.com/x.png",
      inventory: 25,
      name: "Desk Mat",
      priceCents: 1990,
      slug: "desk-mat",
    });
  });

  it("treats blank inventory as untracked and rejects bad input", () => {
    const ok = normalizeCommerceProductInput({ name: "X", price: "1", inventory: "" });
    expect("inventory" in ok && ok.inventory).toBeNull();
    expect(normalizeCommerceProductInput({ name: "", price: "1" })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeCommerceProductInput({ name: "X", price: "-2" })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeCommerceProductInput({ name: "X", price: "1", inventory: "-3" })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeCommerceProductInput({ name: "X", price: "1", slug: "!!!" })).toEqual({
      error: expect.any(String),
    });
    expect(normalizeCommerceProductInput({ name: "X", price: "1", imageUrl: "notaurl" })).toEqual({
      error: expect.any(String),
    });
  });
});

describe("normalizeOrderItems", () => {
  it("accepts positive integer quantities and rejects the rest", () => {
    expect(normalizeOrderItems([{ productId: "p1", quantity: 2 }])).toEqual([
      { productId: "p1", quantity: 2 },
    ]);
    expect(normalizeOrderItems([{ productId: "p1", quantity: 0 }])).toEqual({
      error: expect.any(String),
    });
    expect(normalizeOrderItems([{ productId: "", quantity: 1 }])).toEqual({
      error: expect.any(String),
    });
    expect(normalizeOrderItems([{ productId: "p1", quantity: 1.5 }])).toEqual({
      error: expect.any(String),
    });
    expect(normalizeOrderItems([])).toEqual({ error: expect.any(String) });
  });
});

describe("normalizeCustomerEmail", () => {
  it("lowercases plausible emails and rejects malformed input", () => {
    expect(normalizeCustomerEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
    expect(normalizeCustomerEmail("nope")).toBeNull();
    expect(normalizeCustomerEmail("a@b")).toBeNull();
    expect(normalizeCustomerEmail("")).toBeNull();
  });
});

describe("computeOrderTotalCents", () => {
  it("sums quantity × unit price", () => {
    expect(
      computeOrderTotalCents([
        { quantity: 2, unitPriceCents: 999 },
        { quantity: 1, unitPriceCents: 499 },
      ]),
    ).toBe(2497);
  });
});

describe("order status transitions", () => {
  it("recognizes the lifecycle states", () => {
    for (const status of COMMERCE_ORDER_STATUSES) {
      expect(isCommerceOrderStatus(status)).toBe(true);
    }
    expect(isCommerceOrderStatus("shipped")).toBe(false);
    for (const status of ["draft", "active", "archived"]) {
      expect(isCommerceProductStatus(status)).toBe(true);
    }
    expect(isCommerceProductStatus("live")).toBe(false);
  });

  it("walks pending → paid → fulfilled, with cancel/refund branches", () => {
    expect(evaluateOrderStatusChange("pending", "paid")).toEqual({ ok: true });
    expect(evaluateOrderStatusChange("pending", "cancelled")).toEqual({ ok: true });
    expect(evaluateOrderStatusChange("pending", "fulfilled")).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(evaluateOrderStatusChange("paid", "fulfilled")).toEqual({ ok: true });
    expect(evaluateOrderStatusChange("paid", "refunded")).toEqual({ ok: true });
    expect(evaluateOrderStatusChange("fulfilled", "refunded")).toEqual({ ok: true });
    expect(evaluateOrderStatusChange("cancelled", "paid")).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(evaluateOrderStatusChange("refunded", "paid")).toEqual({
      ok: false,
      reason: "forbidden",
    });
    expect(evaluateOrderStatusChange("pending", "pending")).toEqual({
      ok: false,
      reason: "unchanged",
    });
    expect(evaluateOrderStatusChange("pending", "shipped")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("formatCents", () => {
  it("formats with Intl currency display and falls back safely", () => {
    expect(formatCents(1299, "usd")).toBe("$12.99");
    expect(formatCents(50, "usd")).toContain("0.50");
    expect(formatCents(1299, "not-a-currency")).toBe("12.99 NOT-A-CURRENCY");
  });
});

describe("commerce server actions contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const actions = readFileSync(join(here, "commerce-actions.ts"), "utf8");

  it("scopes every query and mutation by workspaceId", () => {
    expect(
      actions.match(/eq\(commerce(Product|Order|OrderItem)\.workspaceId/g)?.length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("gates all management operations behind the workspace manager role", () => {
    expect(actions.match(/requireWorkspaceManager\(\)/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("computes order totals server-side and emits order webhook events", () => {
    expect(actions).toContain("computeOrderTotalCents");
    expect(actions).toContain('"commerce.order_created"');
    expect(actions).toContain('"commerce.order_status_changed"');
  });
});
