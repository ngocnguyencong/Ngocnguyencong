import { NextResponse } from "next/server";

import {
  setCommerceProductStatusAction,
  updateCommerceProductAction,
} from "../../../../../../src/commerce-actions";
import { isCommerceProductStatus } from "../../../../../../src/commerce";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../../src/request-body";
import { requireWorkspaceManager } from "../../../../../../src/workspace-access";

export const runtime = "nodejs";

/** Fields forwarded verbatim to `updateCommerceProductAction`. */
const PRODUCT_FIELD_KEYS = [
  "currency",
  "description",
  "imageUrl",
  "inventory",
  "name",
  "price",
  "slug",
] as const;

function managerErrorResponse(error: string) {
  return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 403 });
}

/**
 * `PATCH /api/mobile/commerce/products/:productId` — two composable
 * operations (owner/admin):
 *
 * - Field update: any of `currency`, `description`, `imageUrl`,
 *   `inventory`, `name`, `price`, `slug` (strings) runs
 *   `updateCommerceProductAction`. Semantics match the web editor —
 *   full-form replace, so `name` + `price` must be present (the shared
 *   normalizer requires them).
 * - Lifecycle: `"status": "draft" | "active" | "archived"` runs
 *   `setCommerceProductStatusAction`. Transitions are free in both
 *   directions; an unchanged status is a silent no-op server-side.
 *   There is no delete action — `archived` is the removal state.
 *
 * Both may be sent together (fields update first, then status).
 * `{ok:false}` from the update → 422; an unknown status string → 400;
 * a body carrying neither → 400.
 */
export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
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
  const { productId } = await context.params;

  const fields: Partial<Record<(typeof PRODUCT_FIELD_KEYS)[number], string>> = {};
  for (const key of PRODUCT_FIELD_KEYS) {
    const value = body[key];
    if (typeof value === "string") {
      fields[key] = value;
    }
  }
  const hasFieldUpdate = Object.keys(fields).length > 0;
  const status = body.status;
  if (!hasFieldUpdate && status === undefined) {
    return NextResponse.json(
      { error: "Provide product fields or a status to update." },
      { status: 400 },
    );
  }
  if (status !== undefined && !isCommerceProductStatus(status)) {
    return NextResponse.json(
      { error: "Status must be draft, active, or archived." },
      { status: 400 },
    );
  }
  if (hasFieldUpdate) {
    const result = await updateCommerceProductAction({ productId, ...fields });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }
  }
  if (status !== undefined) {
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("status", status);
    await setCommerceProductStatusAction(formData);
  }
  return NextResponse.json({ ok: true });
}
