import { slugify } from "./slug";

export const COMMERCE_PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
export type CommerceProductStatus = (typeof COMMERCE_PRODUCT_STATUSES)[number];

export const COMMERCE_ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
] as const;
export type CommerceOrderStatus = (typeof COMMERCE_ORDER_STATUSES)[number];

/** ~$1M ceiling keeps integer cents safely inside int4 and catches input mistakes. */
export const MAX_PRICE_CENTS = 99_999_999;
export const MAX_ORDER_QUANTITY = 9_999;
export const DEFAULT_CURRENCY = "usd";

/** Forward-only lifecycle: pending → paid → fulfilled; cancel pre-payment, refund post-payment. */
const ORDER_TRANSITIONS: Readonly<Record<CommerceOrderStatus, readonly CommerceOrderStatus[]>> = {
  pending: ["paid", "cancelled"],
  paid: ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function isCommerceProductStatus(value: unknown): value is CommerceProductStatus {
  return (
    typeof value === "string" && (COMMERCE_PRODUCT_STATUSES as readonly string[]).includes(value)
  );
}

export function isCommerceOrderStatus(value: unknown): value is CommerceOrderStatus {
  return (
    typeof value === "string" && (COMMERCE_ORDER_STATUSES as readonly string[]).includes(value)
  );
}

/** Statuses an order may move to next; empty for terminal states. */
export function allowedOrderTransitions(status: string): readonly CommerceOrderStatus[] {
  return isCommerceOrderStatus(status) ? ORDER_TRANSITIONS[status] : [];
}

export type OrderStatusDecision =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "forbidden" | "invalid" | "unchanged" }>;

export function evaluateOrderStatusChange(current: string, next: string): OrderStatusDecision {
  if (!isCommerceOrderStatus(next)) {
    return { ok: false, reason: "invalid" };
  }
  if (next === current) {
    return { ok: false, reason: "unchanged" };
  }
  if (!isCommerceOrderStatus(current) || !ORDER_TRANSITIONS[current].includes(next)) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true };
}

/**
 * Parses a human price ("12.99", "$9.99", "12") into integer cents. Returns
 * null on anything negative, over-precise (>2 decimals), or non-numeric.
 */
export function parsePriceCents(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/^[$€£¥]\s?/, "")
    .replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const cents = Math.round(Number.parseFloat(cleaned) * 100);
  return cents >= 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return /^[a-z]{3}$/.test(normalized) ? normalized : null;
}

export type CommerceProductDraft = Readonly<{
  currency: string;
  description: string | null;
  imageUrl: string | null;
  inventory: number | null;
  name: string;
  priceCents: number;
  slug: string;
}>;

export function normalizeCommerceProductInput(
  raw: Readonly<{
    currency?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    inventory?: string | undefined;
    name?: string | undefined;
    price?: string | undefined;
    slug?: string | undefined;
  }>,
): CommerceProductDraft | { error: string } {
  const name = (raw.name ?? "").trim();
  if (name.length === 0 || name.length > 200) {
    return { error: "A product name of 1-200 characters is required." };
  }
  const priceCents = parsePriceCents(raw.price ?? "");
  if (priceCents === null) {
    return { error: "A non-negative price with at most two decimals is required." };
  }
  const currencyInput = (raw.currency ?? "").trim();
  const currency = currencyInput.length === 0 ? DEFAULT_CURRENCY : normalizeCurrency(currencyInput);
  if (currency === null) {
    return { error: "Currency must be a three-letter code (e.g. usd)." };
  }
  const slugInput = (raw.slug ?? "").trim();
  const slug = slugInput.length > 0 ? slugify(slugInput, 120) : slugify(name, 120);
  if (slug.length === 0) {
    return { error: "A URL-safe product slug is required (letters and digits)." };
  }
  const inventoryRaw = (raw.inventory ?? "").trim();
  let inventory: number | null = null;
  if (inventoryRaw.length > 0) {
    if (!/^\d+$/.test(inventoryRaw)) {
      return { error: "Inventory must be a non-negative whole number (blank = untracked)." };
    }
    inventory = Number.parseInt(inventoryRaw, 10);
    if (inventory > 999_999_999) {
      return { error: "Inventory must be a non-negative whole number (blank = untracked)." };
    }
  }
  const imageUrl = (raw.imageUrl ?? "").trim();
  if (imageUrl.length > 0) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { error: "Image URL must be an http(s) URL." };
      }
    } catch {
      return { error: "Image URL must be an http(s) URL." };
    }
  }
  const description = (raw.description ?? "").trim();
  return {
    currency,
    description: description.length > 0 ? description : null,
    imageUrl: imageUrl.length > 0 ? imageUrl : null,
    inventory,
    name,
    priceCents,
    slug,
  };
}

export type OrderItemInput = Readonly<{ productId: string; quantity: number }>;

/**
 * Validates requested line items: non-empty product ids, whole quantities in
 * 1–9999, duplicate products merged by summing quantities.
 */
export function normalizeOrderItems(
  raw: readonly Readonly<{ productId?: unknown; quantity?: unknown }>[],
): readonly OrderItemInput[] | { error: string } {
  if (raw.length === 0) {
    return { error: "At least one line item is required." };
  }
  const merged = new Map<string, number>();
  for (const item of raw) {
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
    if (productId.length === 0) {
      return { error: "Every line item needs a product." };
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY) {
      return {
        error: `Quantity for ${productId} must be a whole number between 1 and ${MAX_ORDER_QUANTITY}.`,
      };
    }
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Lowercases and sanity-checks a customer email (not a deliverability check). */
export function normalizeCustomerEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const email = value.trim().toLowerCase();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function computeOrderTotalCents(
  items: readonly Readonly<{ quantity: number; unitPriceCents: number }>[],
): number {
  return items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
}

/** Intl currency display with a safe fallback for non-ISO codes. */
export function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", { currency, style: "currency" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
