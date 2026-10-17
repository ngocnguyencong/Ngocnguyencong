import { NextResponse } from "next/server";

import {
  getNotificationPreferencesForRequest,
  listNotificationsForRequest,
  markNotificationReadForRequest,
  updateNotificationPreferencesForRequest,
} from "../../../src/notification-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "preferences") {
    const result = await getNotificationPreferencesForRequest(request.headers);
    if (!result.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ preferences: result.preferences }, { status: 200 });
  }

  const result = await listNotificationsForRequest(request.headers);
  if (!result.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ notifications: result.notifications }, { status: 200 });
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Preferences patch: {preferences: {emailInvites?, emailBilling?, inAppProduct?}}
  // — used by the notification-settings surfaces on web and mobile.
  if (typeof body === "object" && body !== null && "preferences" in body) {
    const patch =
      typeof body.preferences === "object" && body.preferences !== null
        ? Object.fromEntries(
            Object.entries(body.preferences as Record<string, unknown>).filter(
              ([key, value]) =>
                ["emailInvites", "emailBilling", "inAppProduct"].includes(key) &&
                typeof value === "boolean",
            ),
          )
        : {};
    const result = await updateNotificationPreferencesForRequest(request.headers, patch);
    if (!result.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: result.status });
    }
    return NextResponse.json({ preferences: result.preferences }, { status: 200 });
  }

  const id =
    typeof body === "object" && body !== null && "id" in body && typeof body.id === "string"
      ? (body as { id: string }).id
      : "";

  const result = await markNotificationReadForRequest(request.headers, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.status === 401 ? "Unauthorized" : "Not found" },
      { status: result.status },
    );
  }
  return NextResponse.json({ notification: result.notification }, { status: 200 });
}
