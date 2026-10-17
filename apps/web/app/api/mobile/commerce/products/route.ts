import { NextResponse } from "next/server";

import {
  createCommerceProductAction,
  listCommerceProducts,
} from "../../../../../src/commerce-actions";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../../src/request-body";
import { requireWorkspaceManager } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

function managerErrorResponse(error: string) {
  return NextResponse.json({ error }, { status: error === "Sign in required." ? 401 : 403 });
}

/**
 * `GET /api/mobile/commerce/products` — catalog for the caller's active
 * workspace, newest first (`createdAt` serialized to ISO). Owner/admin
 * only — the shared action returns 401/403-worthy errors.
 */
export async function GET() {
  const result = await listCommerceProducts();
  if (result.error !== undefined) {
    return managerErrorResponse(result.error);
  }
  return NextResponse.json({
    manageable: result.manageable,
    products: result.products.map((product) => ({
      createdAt: product.createdAt.toISOString(),
      currency: product.currency,
      description: product.description,
      id: product.id,
      imageUrl: product.imageUrl,
      inventory: product.inventory,
      name: product.name,
      priceCents: product.priceCents,
      slug: product.slug,
      status: product.status,
    })),
  });
}

/**
 * `POST /api/mobile/commerce/products` — creates a draft product. Body:
 * `{name?, slug?, price?, currency?, description?, imageUrl?, inventory?}`
 * (all strings; `price` is a human amount like "12.99" — the shared
 * normalizer parses it to integer cents and rejects >2 decimals;
 * `inventory` is a non-negative whole number, blank = untracked).
 * 201 → `{id}`; validation/duplicate-slug failures → 422 `{error}`.
 */
export async function POST(request: Request) {
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
  const text = (key: string): string => {
    const value = body[key];
    return typeof value === "string" ? value : "";
  };
  const result = await createCommerceProductAction({
    currency: text("currency"),
    description: text("description"),
    imageUrl: text("imageUrl"),
    inventory: text("inventory"),
    name: text("name"),
    price: text("price"),
    slug: text("slug"),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
