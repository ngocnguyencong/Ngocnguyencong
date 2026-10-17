import { NextResponse } from "next/server";

import { setCommerceOrderStatusAction } from "../../../../../../src/commerce-actions";
import { isCommerceOrderStatus } from "../../../../../../src/commerce";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../../src/request-body";
import { requireWorkspaceManager } from "../../../../../../src/workspace-access";

export const runtime = "nodejs";

function managerErrorResponse(error: string) {
  return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 403 });
}

/**
 * `PATCH /api/mobile/commerce/orders/:orderId` — advances an order's
 * lifecycle (owner/admin). Body: `{"status": "pending" | "paid" |
 * "fulfilled" | "cancelled" | "refunded"}`.
 *
 * Legal transitions are forward-only — `pending → paid → fulfilled`,
 * with `cancelled` (pre-payment) and `refunded` (post-payment) branches —
 * enforced inside `setCommerceOrderStatusAction` via
 * `evaluateOrderStatusChange`; an illegal or unchanged transition is a
 * silent no-op server-side (the mobile client only offers
 * `allowedOrderTransitions`). Cancelling restocks tracked inventory.
 * Unknown status strings → 400 here.
 */
export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const manager = await requireWorkspaceManager();
  if ("error" in manager) {
    return managerErrorResponse(manager.error);
  }
  let body: Record<string, unknown>;
  try {
    const value: unknown = await readBoundedJson(request);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return NextResponse.json({ error: "A JSON object is required." }, { status: 400 });
    }
    body = value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "The request body is too large." }, { status: 413 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }
    throw error;
  }
  const { orderId } = await context.params;
  const status = body.status;
  if (status === undefined) {
    return NextResponse.json({ error: "Provide a status to update." }, { status: 400 });
  }
  if (!isCommerceOrderStatus(status)) {
    return NextResponse.json(
      { error: "Status must be pending, paid, fulfilled, cancelled, or refunded." },
      { status: 400 },
    );
  }
  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("status", status);
  await setCommerceOrderStatusAction(formData);
  return NextResponse.json({ ok: true });
}
