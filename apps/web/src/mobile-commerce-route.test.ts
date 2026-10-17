import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProduct: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  requireManager: vi.fn(),
  setOrderStatus: vi.fn(),
  setProductStatus: vi.fn(),
  updateProduct: vi.fn(),
}));
vi.mock("./commerce-actions", () => ({
  createCommerceProductAction: mocks.createProduct,
  listCommerceOrders: mocks.listOrders,
  listCommerceProducts: mocks.listProducts,
  setCommerceOrderStatusAction: mocks.setOrderStatus,
  setCommerceProductStatusAction: mocks.setProductStatus,
  updateCommerceProductAction: mocks.updateProduct,
}));
vi.mock("./workspace-access", () => ({ requireWorkspaceManager: mocks.requireManager }));

import {
  GET as GET_PRODUCTS,
  POST as POST_PRODUCT,
} from "../app/api/mobile/commerce/products/route";
import { PATCH as PATCH_PRODUCT } from "../app/api/mobile/commerce/products/[productId]/route";
import { GET as GET_ORDERS } from "../app/api/mobile/commerce/orders/route";
import { PATCH as PATCH_ORDER } from "../app/api/mobile/commerce/orders/[orderId]/route";

const product = {
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
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
  createdAt: new Date("2026-10-05T09:00:00.000Z"),
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

const productsUrl = "https://app.test/api/mobile/commerce/products";
const productUrl = "https://app.test/api/mobile/commerce/products/prd_1";
const productContext = { params: Promise.resolve({ productId: "prd_1" }) };
const orderUrl = "https://app.test/api/mobile/commerce/orders/ord_1";
const orderContext = { params: Promise.resolve({ orderId: "ord_1" }) };

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { body: JSON.stringify(body), method });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireManager.mockResolvedValue({ userId: "user_1", workspaceId: "ws_1" });
  mocks.listProducts.mockResolvedValue({ manageable: true, products: [product] });
  mocks.listOrders.mockResolvedValue({ manageable: true, orders: [order] });
  mocks.createProduct.mockResolvedValue({ id: "prd_1", ok: true });
  mocks.updateProduct.mockResolvedValue({ id: "prd_1", ok: true });
  mocks.setProductStatus.mockResolvedValue(undefined);
  mocks.setOrderStatus.mockResolvedValue(undefined);
});

describe("/api/mobile/commerce/products route", () => {
  it("GET serializes products with ISO dates and the manageable flag", async () => {
    const response = await GET_PRODUCTS();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      manageable: true,
      products: [{ ...product, createdAt: "2026-10-01T12:00:00.000Z" }],
    });
  });

  it("GET maps list errors to 401/403", async () => {
    mocks.listProducts.mockResolvedValue({
      error: "Owner or admin role required.",
      manageable: false,
      products: [],
    });
    expect((await GET_PRODUCTS()).status).toBe(403);
    mocks.listProducts.mockResolvedValue({
      error: "Sign in required.",
      manageable: false,
      products: [],
    });
    expect((await GET_PRODUCTS()).status).toBe(401);
  });

  it("POST authenticates before consuming the body", async () => {
    mocks.requireManager.mockResolvedValue({ error: "Owner or admin role required." });
    const request = jsonRequest(productsUrl, "POST", { name: "P", price: "9.99" });
    expect((await POST_PRODUCT(request)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(mocks.createProduct).not.toHaveBeenCalled();
  });

  it("POST forwards fields and returns 201 {id} / 422 on failure", async () => {
    const response = await POST_PRODUCT(
      jsonRequest(productsUrl, "POST", {
        inventory: "12",
        name: "Sample product",
        price: "12.99",
      }),
    );
    expect(mocks.createProduct).toHaveBeenCalledWith({
      currency: "",
      description: "",
      imageUrl: "",
      inventory: "12",
      name: "Sample product",
      price: "12.99",
      slug: "",
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "prd_1" });

    mocks.createProduct.mockResolvedValue({
      error: "A non-negative price with at most two decimals is required.",
      ok: false,
    });
    expect((await POST_PRODUCT(jsonRequest(productsUrl, "POST", { name: "P" }))).status).toBe(422);
  });
});

describe("/api/mobile/commerce/products/[productId] route", () => {
  it("PATCH forwards fields to the update action", async () => {
    const response = await PATCH_PRODUCT(
      jsonRequest(productUrl, "PATCH", { name: "Renamed", price: "15" }),
      productContext,
    );
    expect(mocks.updateProduct).toHaveBeenCalledWith({
      name: "Renamed",
      price: "15",
      productId: "prd_1",
    });
    expect(response.status).toBe(200);
  });

  it("PATCH status bridges to the FormData status action", async () => {
    const response = await PATCH_PRODUCT(
      jsonRequest(productUrl, "PATCH", { status: "archived" }),
      productContext,
    );
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    const form = mocks.setProductStatus.mock.calls[0]![0] as FormData;
    expect(form.get("productId")).toBe("prd_1");
    expect(form.get("status")).toBe("archived");
    expect(response.status).toBe(200);
  });

  it("PATCH rejects an unknown status and an empty body with 400", async () => {
    expect(
      (await PATCH_PRODUCT(jsonRequest(productUrl, "PATCH", { status: "hidden" }), productContext))
        .status,
    ).toBe(400);
    expect((await PATCH_PRODUCT(jsonRequest(productUrl, "PATCH", {}), productContext)).status).toBe(
      400,
    );
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.setProductStatus).not.toHaveBeenCalled();
  });
});

describe("/api/mobile/commerce/orders routes", () => {
  it("GET serializes orders with ISO dates and line items", async () => {
    const response = await GET_ORDERS();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      manageable: true,
      orders: [{ ...order, createdAt: "2026-10-05T09:00:00.000Z" }],
    });
  });

  it("PATCH bridges {status} to the FormData order action", async () => {
    const response = await PATCH_ORDER(
      jsonRequest(orderUrl, "PATCH", { status: "paid" }),
      orderContext,
    );
    const form = mocks.setOrderStatus.mock.calls[0]![0] as FormData;
    expect(form.get("orderId")).toBe("ord_1");
    expect(form.get("status")).toBe("paid");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("PATCH validates the status and requires the manager role", async () => {
    expect(
      (await PATCH_ORDER(jsonRequest(orderUrl, "PATCH", { status: "shipped" }), orderContext))
        .status,
    ).toBe(400);
    expect((await PATCH_ORDER(jsonRequest(orderUrl, "PATCH", {}), orderContext)).status).toBe(400);

    mocks.requireManager.mockResolvedValue({ error: "Owner or admin role required." });
    const request = jsonRequest(orderUrl, "PATCH", { status: "paid" });
    expect((await PATCH_ORDER(request, orderContext)).status).toBe(403);
    expect(request.bodyUsed).toBe(false);
    expect(mocks.setOrderStatus).not.toHaveBeenCalled();
  });
});
