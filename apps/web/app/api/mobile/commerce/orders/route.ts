import { NextResponse } from "next/server";

import { listCommerceOrders } from "../../../../../src/commerce-actions";

export const runtime = "nodejs";

/**
 * `GET /api/mobile/commerce/orders` — orders for the caller's active
 * workspace, newest first (`createdAt` serialized to ISO; each order
 * carries its line items). Owner/admin only. Orders are created by
 * checkout flows — there is intentionally no POST here.
 */
export async function GET() {
  const result = await listCommerceOrders();
  if (result.error !== undefined) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Sign in required." ? 401 : 403 },
    );
  }
  return NextResponse.json({
    manageable: result.manageable,
    orders: result.orders.map((order) => ({
      createdAt: order.createdAt.toISOString(),
      currency: order.currency,
      customerEmail: order.customerEmail,
      id: order.id,
      items: order.items,
      status: order.status,
      totalCents: order.totalCents,
    })),
  });
}
