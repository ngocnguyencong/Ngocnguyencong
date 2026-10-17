import { NextResponse } from "next/server";

import { mobilePushTokensBff } from "../../../../src/mobile-push-tokens";

export const runtime = "nodejs";

/** Lists the caller's registered device push tokens. */
export async function GET(request: Request) {
  const response = await mobilePushTokensBff.list(request.headers);
  return NextResponse.json(response.body, { status: response.status });
}

/** Registers (upserts) a device push token under the session user + active workspace. */
export async function POST(request: Request) {
  let body: { platform?: unknown; token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const response = await mobilePushTokensBff.register(request.headers, body);
  return NextResponse.json(response.body, { status: response.status });
}

/** Removes one of the caller's device push tokens. */
export async function DELETE(request: Request) {
  let body: { token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const response = await mobilePushTokensBff.unregister(request.headers, body);
  return NextResponse.json(response.body, { status: response.status });
}
