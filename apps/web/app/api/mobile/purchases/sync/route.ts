import { mobilePurchasesBff } from "../../../../../src/mobile-purchases-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const response = await mobilePurchasesBff.get(request.headers);
  return Response.json(response.body, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Client purchase, customer and workspace claims do not determine access. */
export async function POST(request: Request) {
  const response = await mobilePurchasesBff.post(request.headers);
  return Response.json(response.body, {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
