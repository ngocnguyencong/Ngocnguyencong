import { describe, expect, test } from "vitest";

import { createMobileApiClient, type MobileApiFetch } from "../api/client";
import { allowedOrderTransitions, createMobileCommerceActions, formatCents } from "./client";

function makeApi(routes: Record<string, unknown>, seen?: { path: string; method: string }[]) {
  const transport: MobileApiFetch = async (url, init) => {
    const path = new URL(url).pathname + new URL(url).search;
    seen?.push({ method: init.method, path });
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

const product = {
  createdAt: "2026-10-01T12:00:00.000Z",
  currency: "usd",
  description: null,
  id: "prd_1",
  imageUrl: null,
  inventory: 8,
  name: "Sample product",
  priceCents: 1299,
  slug: "sample-product",
  status: "active",
};

const order = {
  createdAt: "2026-10-05T09:00:00.000Z",
  currency: "usd",
  customerEmail: "buyer@example.test",
  id: "ord_1",
  items: [
    {
      id: "ori_1",
      productId: "prd_1",
      productName: "Sample product",
      quantity: 2,
      unitPriceCents: 1299,
    },
  ],
  status: "pending",
  totalCents: 2598,
};

describe("createMobileCommerceActions", () => {
  test("products.list filters malformed rows and reads manageable", async () => {
    const commerce = createMobileCommerceActions(
      makeApi({
        "/api/mobile/commerce/products": {
          manageable: true,
          products: [product, { bad: true }, { ...product, id: "prd_2", status: "nope" }],
        },
      }),
    );
    const payload = await commerce.products.list();
    expect(payload.manageable).toBe(true);
    expect(payload.products).toHaveLength(1);
    expect(payload.products[0]?.id).toBe("prd_1");
  });

  test("products.create POSTs fields and unwraps {id}", async () => {
    const seen: { method: string; path: string }[] = [];
    const commerce = createMobileCommerceActions(
      makeApi({ "/api/mobile/commerce/products": { id: "prd_9" } }, seen),
    );
    await expect(
      commerce.products.create({ name: "Sample product", price: "12.99" }),
    ).resolves.toEqual({ id: "prd_9" });
    expect(seen[0]).toEqual({ method: "POST", path: "/api/mobile/commerce/products" });
  });

  test("products.update + setStatus PATCH the product route", async () => {
    const seen: { method: string; path: string }[] = [];
    const commerce = createMobileCommerceActions(
      makeApi({ "/api/mobile/commerce/products/prd_1": { ok: true } }, seen),
    );
    await commerce.products.update("prd_1", { name: "Renamed", price: "15" });
    await commerce.products.setStatus("prd_1", "archived");
    expect(seen[0]).toEqual({ method: "PATCH", path: "/api/mobile/commerce/products/prd_1" });
    expect(seen[1]).toEqual({ method: "PATCH", path: "/api/mobile/commerce/products/prd_1" });
  });

  test("orders.list validates line items and drops malformed orders", async () => {
    const commerce = createMobileCommerceActions(
      makeApi({
        "/api/mobile/commerce/orders": {
          manageable: true,
          orders: [order, { ...order, id: "ord_2", items: [{ bad: true }] }],
        },
      }),
    );
    const payload = await commerce.orders.list();
    expect(payload.orders).toHaveLength(1);
    expect(payload.orders[0]?.items[0]?.productName).toBe("Sample product");
    expect(payload.orders[0]?.totalCents).toBe(2598);
  });

  test("orders.setStatus PATCHes {status} to the order route", async () => {
    const seen: { method: string; path: string }[] = [];
    const commerce = createMobileCommerceActions(
      makeApi({ "/api/mobile/commerce/orders/ord_1": { ok: true } }, seen),
    );
    await commerce.orders.setStatus("ord_1", "paid");
    expect(seen[0]).toEqual({ method: "PATCH", path: "/api/mobile/commerce/orders/ord_1" });
  });
});

describe("allowedOrderTransitions", () => {
  test("mirrors the forward-only web lifecycle", () => {
    expect(allowedOrderTransitions("pending")).toEqual(["paid", "cancelled"]);
    expect(allowedOrderTransitions("paid")).toEqual(["fulfilled", "refunded"]);
    expect(allowedOrderTransitions("fulfilled")).toEqual(["refunded"]);
    expect(allowedOrderTransitions("cancelled")).toEqual([]);
    expect(allowedOrderTransitions("refunded")).toEqual([]);
  });
});

describe("formatCents", () => {
  test("formats known currencies and falls back for malformed codes", () => {
    expect(formatCents(1299, "usd")).toBe("$12.99");
    expect(formatCents(100, "not-a-code")).toBe("1.00 NOT-A-CODE");
  });
});
