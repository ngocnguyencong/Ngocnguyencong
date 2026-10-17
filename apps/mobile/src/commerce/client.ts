import type { MobileApiClient } from "../api/client";

/** Mirrors `COMMERCE_PRODUCT_STATUSES` in `apps/web/src/commerce.ts` — keep in sync. */
export const COMMERCE_PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type CommerceProductStatus = (typeof COMMERCE_PRODUCT_STATUSES)[number];

/** Mirrors `COMMERCE_ORDER_STATUSES` in `apps/web/src/commerce.ts` — keep in sync. */
export const COMMERCE_ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;
export type CommerceOrderStatus = (typeof COMMERCE_ORDER_STATUSES)[number];

/**
 * Mirrors `ORDER_TRANSITIONS` in `apps/web/src/commerce.ts` — keep in
 * sync. Forward-only: pending → paid → fulfilled; cancel pre-payment,
 * refund post-payment. The server still re-validates every transition.
 */
const ORDER_TRANSITIONS: Readonly<Record<CommerceOrderStatus, readonly CommerceOrderStatus[]>> = {
  pending: ["paid", "cancelled"],
  paid: ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function allowedOrderTransitions(
  status: CommerceOrderStatus,
): readonly CommerceOrderStatus[] {
  return ORDER_TRANSITIONS[status];
}

export interface CommerceProduct {
  createdAt: string;
  currency: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  inventory: number | null;
  name: string;
  priceCents: number;
  slug: string;
  status: CommerceProductStatus;
}

/** Fields accepted by `POST`/`PATCH /api/mobile/commerce/products`. */
export interface CommerceProductFields {
  currency?: string;
  description?: string;
  imageUrl?: string;
  inventory?: string;
  name?: string;
  price?: string;
  slug?: string;
}

export interface CommerceOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CommerceOrder {
  createdAt: string;
  currency: string;
  customerEmail: string;
  id: string;
  items: CommerceOrderItem[];
  status: CommerceOrderStatus;
  totalCents: number;
}

/** Intl currency display with a safe fallback — mirrors `formatCents` in `apps/web/src/commerce.ts`. */
export function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { currency, style: "currency" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCommerceProductStatus(value: unknown): value is CommerceProductStatus {
  return (
    typeof value === "string" && (COMMERCE_PRODUCT_STATUSES as readonly string[]).includes(value)
  );
}

function isCommerceOrderStatus(value: unknown): value is CommerceOrderStatus {
  return (
    typeof value === "string" && (COMMERCE_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Rows missing a usable id/name/status/price are dropped rather than
// guessed — defaults would mislabel the catalog or mis-price orders.
function isCommerceProduct(value: unknown): value is CommerceProduct {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    typeof value.currency === "string" &&
    typeof value.priceCents === "number" &&
    isCommerceProductStatus(value.status) &&
    isIsoDate(value.createdAt) &&
    (value.description === null || typeof value.description === "string") &&
    (value.imageUrl === null || typeof value.imageUrl === "string") &&
    (value.inventory === null || typeof value.inventory === "number")
  );
}

function isCommerceOrderItem(value: unknown): value is CommerceOrderItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.productName === "string" &&
    typeof value.quantity === "number" &&
    typeof value.unitPriceCents === "number" &&
    (value.productId === null || typeof value.productId === "string")
  );
}

function isCommerceOrder(value: unknown): value is CommerceOrder {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.customerEmail === "string" &&
    typeof value.currency === "string" &&
    typeof value.totalCents === "number" &&
    isCommerceOrderStatus(value.status) &&
    isIsoDate(value.createdAt) &&
    Array.isArray(value.items) &&
    (value.items as unknown[]).every(isCommerceOrderItem)
  );
}

function listRows<T>(payload: unknown, key: string, guard: (v: unknown) => v is T): T[] {
  if (!isRecord(payload) || !Array.isArray(payload[key])) {
    throw new Error("The response was invalid.");
  }
  return (payload[key] as unknown[]).filter(guard);
}

function productPath(productId: string): string {
  return `/api/mobile/commerce/products/${encodeURIComponent(productId)}`;
}

/**
 * `/api/mobile/commerce/{products,orders}` — workspace catalog + orders.
 * Owner/admin only server-side. Orders are created by checkout flows, so
 * the client exposes list + status transitions only.
 */
export function createMobileCommerceActions(api: MobileApiClient) {
  return {
    orders: {
      async list(): Promise<{ manageable: boolean; orders: CommerceOrder[] }> {
        const payload = await api.request<unknown>("/api/mobile/commerce/orders");
        return {
          manageable: isRecord(payload) && payload.manageable === true,
          orders: listRows(payload, "orders", isCommerceOrder),
        };
      },
      async setStatus(orderId: string, status: CommerceOrderStatus): Promise<void> {
        await api.request(`/api/mobile/commerce/orders/${encodeURIComponent(orderId)}`, {
          body: { status },
          method: "PATCH",
        });
      },
    },
    products: {
      async create(fields: CommerceProductFields): Promise<{ id: string }> {
        const payload = await api.request<unknown>("/api/mobile/commerce/products", {
          body: fields,
          method: "POST",
        });
        if (!isRecord(payload) || typeof payload.id !== "string") {
          throw new Error("The product could not be created.");
        }
        return { id: payload.id };
      },
      async list(): Promise<{ manageable: boolean; products: CommerceProduct[] }> {
        const payload = await api.request<unknown>("/api/mobile/commerce/products");
        return {
          manageable: isRecord(payload) && payload.manageable === true,
          products: listRows(payload, "products", isCommerceProduct),
        };
      },
      async setStatus(productId: string, status: CommerceProductStatus): Promise<void> {
        await api.request(productPath(productId), { body: { status }, method: "PATCH" });
      },
      /** Full-form replace — `name` + `price` are required server-side. */
      async update(productId: string, fields: CommerceProductFields): Promise<void> {
        await api.request(productPath(productId), { body: fields, method: "PATCH" });
      },
    },
  };
}
