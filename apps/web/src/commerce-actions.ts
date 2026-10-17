"use server";

import { randomUUID } from "node:crypto";

import { AUDIT_ACTIONS, commerceOrder, commerceOrderItem, commerceProduct } from "@supastack/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "./audit-runtime";
import { database } from "./auth-runtime";
import { isUniqueViolation } from "./db-errors";
import {
  computeOrderTotalCents,
  evaluateOrderStatusChange,
  isCommerceOrderStatus,
  isCommerceProductStatus,
  normalizeCommerceProductInput,
  normalizeCustomerEmail,
  normalizeOrderItems,
  type CommerceOrderStatus,
  type CommerceProductStatus,
} from "./commerce";
import { requireWorkspaceManager } from "./workspace-access";
import { tryEmitWorkspaceEvent } from "./webhook-delivery";

export interface CommerceProductRow {
  createdAt: Date;
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

export interface CommerceOrderItemRow {
  id: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CommerceOrderRow {
  createdAt: Date;
  currency: string;
  customerEmail: string;
  id: string;
  items: CommerceOrderItemRow[];
  status: CommerceOrderStatus;
  totalCents: number;
}

const COMMERCE_PAGE_PATH = "/commerce";

export async function listCommerceProducts(): Promise<{
  error?: string;
  manageable: boolean;
  products: CommerceProductRow[];
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, manageable: false, products: [] };
  }
  const rows = await database
    .select()
    .from(commerceProduct)
    .where(eq(commerceProduct.workspaceId, context.workspaceId))
    .orderBy(desc(commerceProduct.createdAt))
    .limit(500);
  return {
    manageable: true,
    products: rows.map((row) => ({
      ...row,
      status: isCommerceProductStatus(row.status) ? row.status : "draft",
    })),
  };
}

export type CommerceActionResult = { error: string; ok: false } | { id: string; ok: true };

export async function createCommerceProductAction(input: {
  currency?: string;
  description?: string;
  imageUrl?: string;
  inventory?: string;
  name?: string;
  price?: string;
  slug?: string;
}): Promise<CommerceActionResult> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const normalized = normalizeCommerceProductInput(input);
  if ("error" in normalized) {
    return { error: normalized.error, ok: false };
  }
  const productId = `prd_${randomUUID()}`;
  const now = new Date();
  try {
    await database.insert(commerceProduct).values({
      createdAt: now,
      currency: normalized.currency,
      description: normalized.description,
      id: productId,
      imageUrl: normalized.imageUrl,
      inventory: normalized.inventory,
      name: normalized.name,
      priceCents: normalized.priceCents,
      slug: normalized.slug,
      status: "draft",
      updatedAt: now,
      workspaceId: context.workspaceId,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: `A product with slug "${normalized.slug}" already exists.`,
        ok: false,
      };
    }
    throw error;
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.commerceProductCreated,
    actorUserId: context.userId,
    metadata: { name: normalized.name, slug: normalized.slug },
    targetId: productId,
    targetType: "commerce_product",
    workspaceId: context.workspaceId,
  });
  revalidatePath(COMMERCE_PAGE_PATH);
  return { id: productId, ok: true };
}

export async function updateCommerceProductAction(
  input: {
    currency?: string;
    description?: string;
    imageUrl?: string;
    inventory?: string;
    name?: string;
    price?: string;
    slug?: string;
  } & { productId: string },
): Promise<CommerceActionResult> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const normalized = normalizeCommerceProductInput(input);
  if ("error" in normalized) {
    return { error: normalized.error, ok: false };
  }
  try {
    const updated = await database
      .update(commerceProduct)
      .set({
        currency: normalized.currency,
        description: normalized.description,
        imageUrl: normalized.imageUrl,
        inventory: normalized.inventory,
        name: normalized.name,
        priceCents: normalized.priceCents,
        slug: normalized.slug,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(commerceProduct.id, input.productId),
          eq(commerceProduct.workspaceId, context.workspaceId),
        ),
      )
      .returning({ id: commerceProduct.id });
    if (updated.length === 0) {
      return { error: "Product not found.", ok: false };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        error: `A product with slug "${normalized.slug}" already exists.`,
        ok: false,
      };
    }
    throw error;
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.commerceProductUpdated,
    actorUserId: context.userId,
    metadata: { slug: normalized.slug },
    targetId: input.productId,
    targetType: "commerce_product",
    workspaceId: context.workspaceId,
  });
  revalidatePath(COMMERCE_PAGE_PATH);
  return { id: input.productId, ok: true };
}

/** Form action — draft ↔ active ↔ archived. */
export async function setCommerceProductStatusAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    revalidatePath(COMMERCE_PAGE_PATH);
    return;
  }
  const productId = formData.get("productId");
  const next = formData.get("status");
  if (typeof productId !== "string" || typeof next !== "string" || !isCommerceProductStatus(next)) {
    return;
  }
  await database
    .update(commerceProduct)
    .set({ status: next, updatedAt: new Date() })
    .where(
      and(eq(commerceProduct.id, productId), eq(commerceProduct.workspaceId, context.workspaceId)),
    );
  await recordAuditEvent({
    action:
      next === "archived"
        ? AUDIT_ACTIONS.commerceProductArchived
        : AUDIT_ACTIONS.commerceProductUpdated,
    actorUserId: context.userId,
    metadata: { status: next },
    targetId: productId,
    targetType: "commerce_product",
    workspaceId: context.workspaceId,
  });
  revalidatePath(COMMERCE_PAGE_PATH);
}

export async function listCommerceOrders(): Promise<{
  error?: string;
  manageable: boolean;
  orders: CommerceOrderRow[];
}> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, manageable: false, orders: [] };
  }
  const orderRows = await database
    .select()
    .from(commerceOrder)
    .where(eq(commerceOrder.workspaceId, context.workspaceId))
    .orderBy(desc(commerceOrder.createdAt))
    .limit(500);
  if (orderRows.length === 0) {
    return { manageable: true, orders: [] };
  }
  const itemRows = await database
    .select()
    .from(commerceOrderItem)
    .where(
      and(
        eq(commerceOrderItem.workspaceId, context.workspaceId),
        inArray(
          commerceOrderItem.orderId,
          orderRows.map((row) => row.id),
        ),
      ),
    );
  const itemsByOrder = new Map<string, CommerceOrderItemRow[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    });
    itemsByOrder.set(item.orderId, list);
  }
  return {
    manageable: true,
    orders: orderRows.map((row) => ({
      createdAt: row.createdAt,
      currency: row.currency,
      customerEmail: row.customerEmail,
      id: row.id,
      items: itemsByOrder.get(row.id) ?? [],
      status: isCommerceOrderStatus(row.status) ? row.status : "pending",
      totalCents: row.totalCents,
    })),
  };
}

/**
 * Records an order against the workspace catalog. Totals are computed
 * server-side from product rows — clients never submit prices. Tracked
 * inventory decrements atomically and rejects oversells.
 */
export async function createCommerceOrderAction(input: {
  currency?: string;
  customerEmail?: string;
  items?: readonly { productId?: unknown; quantity?: unknown }[];
}): Promise<CommerceActionResult> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    return { error: context.error, ok: false };
  }
  const customerEmail = normalizeCustomerEmail(input.customerEmail);
  if (customerEmail === null) {
    return { error: "A valid customer email is required.", ok: false };
  }
  const items = normalizeOrderItems(input.items ?? []);
  if ("error" in items) {
    return { error: items.error, ok: false };
  }
  const products = await database
    .select()
    .from(commerceProduct)
    .where(
      and(
        eq(commerceProduct.workspaceId, context.workspaceId),
        inArray(
          commerceProduct.id,
          items.map((item) => item.productId),
        ),
      ),
    );
  const byId = new Map(products.map((product) => [product.id, product]));
  const resolved: { product: (typeof products)[number]; quantity: number }[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (product === undefined || product.status !== "active") {
      return { error: "Every line item must reference an active product.", ok: false };
    }
    if (product.inventory !== null && product.inventory < item.quantity) {
      return {
        error: `Not enough inventory for "${product.name}" (${product.inventory} left).`,
        ok: false,
      };
    }
    resolved.push({ product, quantity: item.quantity });
  }
  const currencies = new Set(resolved.map((item) => item.product.currency));
  if (currencies.size > 1) {
    return { error: "All items in one order must share a currency.", ok: false };
  }
  const currency = currencies.values().next().value ?? "usd";
  const orderId = `ord_${randomUUID()}`;
  const now = new Date();
  const totalCents = computeOrderTotalCents(
    resolved.map((item) => ({ quantity: item.quantity, unitPriceCents: item.product.priceCents })),
  );
  await database.insert(commerceOrder).values({
    createdAt: now,
    currency,
    customerEmail,
    id: orderId,
    status: "pending",
    totalCents,
    updatedAt: now,
    workspaceId: context.workspaceId,
  });
  await database.insert(commerceOrderItem).values(
    resolved.map((item) => ({
      createdAt: now,
      id: `ori_${randomUUID()}`,
      orderId,
      productId: item.product.id,
      productName: item.product.name,
      quantity: item.quantity,
      unitPriceCents: item.product.priceCents,
      workspaceId: context.workspaceId,
    })),
  );
  for (const item of resolved) {
    if (item.product.inventory !== null) {
      await database
        .update(commerceProduct)
        .set({
          inventory: sql`${commerceProduct.inventory} - ${item.quantity}`,
          updatedAt: now,
        })
        .where(
          and(
            eq(commerceProduct.id, item.product.id),
            eq(commerceProduct.workspaceId, context.workspaceId),
          ),
        );
    }
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.commerceOrderCreated,
    actorUserId: context.userId,
    metadata: { customerEmail, items: resolved.length, totalCents },
    targetId: orderId,
    targetType: "commerce_order",
    workspaceId: context.workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { customerEmail, orderId, totalCents, currency },
    eventType: "commerce.order_created",
    workspaceId: context.workspaceId,
  });
  revalidatePath(COMMERCE_PAGE_PATH);
  return { id: orderId, ok: true };
}

/** Form action — pending → paid → fulfilled, plus cancel/refund branches. */
export async function setCommerceOrderStatusAction(formData: FormData): Promise<void> {
  const context = await requireWorkspaceManager();
  if ("error" in context) {
    revalidatePath(COMMERCE_PAGE_PATH);
    return;
  }
  const orderId = formData.get("orderId");
  const next = formData.get("status");
  if (typeof orderId !== "string" || typeof next !== "string") {
    return;
  }
  const [current] = await database
    .select({ status: commerceOrder.status })
    .from(commerceOrder)
    .where(and(eq(commerceOrder.id, orderId), eq(commerceOrder.workspaceId, context.workspaceId)))
    .limit(1);
  if (current === undefined) {
    return;
  }
  const decision = evaluateOrderStatusChange(current.status, next);
  if (!decision.ok) {
    revalidatePath(COMMERCE_PAGE_PATH);
    return;
  }
  await database
    .update(commerceOrder)
    .set({ status: next, updatedAt: new Date() })
    .where(and(eq(commerceOrder.id, orderId), eq(commerceOrder.workspaceId, context.workspaceId)));
  // Cancelling restocks tracked inventory; refunds do not (goods may be gone).
  if (next === "cancelled") {
    const items = await database
      .select({
        productId: commerceOrderItem.productId,
        quantity: commerceOrderItem.quantity,
      })
      .from(commerceOrderItem)
      .where(
        and(
          eq(commerceOrderItem.orderId, orderId),
          eq(commerceOrderItem.workspaceId, context.workspaceId),
        ),
      );
    for (const item of items) {
      if (item.productId !== null) {
        await database
          .update(commerceProduct)
          .set({
            inventory: sql`${commerceProduct.inventory} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(commerceProduct.id, item.productId),
              eq(commerceProduct.workspaceId, context.workspaceId),
              sql`${commerceProduct.inventory} IS NOT NULL`,
            ),
          );
      }
    }
  }
  await recordAuditEvent({
    action: AUDIT_ACTIONS.commerceOrderStatusChanged,
    actorUserId: context.userId,
    metadata: { from: current.status, to: next },
    targetId: orderId,
    targetType: "commerce_order",
    workspaceId: context.workspaceId,
  });
  await tryEmitWorkspaceEvent({
    data: { from: current.status, orderId, to: next },
    eventType: "commerce.order_status_changed",
    workspaceId: context.workspaceId,
  });
  revalidatePath(COMMERCE_PAGE_PATH);
}
