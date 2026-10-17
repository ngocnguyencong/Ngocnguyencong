import { NextResponse } from "next/server";

import { getAuthSession } from "../../../../src/auth-runtime";
import { getUserAppearance, saveUserAppearance } from "../../../../src/appearance-sync";
import { readBoundedJson, RequestBodyTooLargeError } from "../../../../src/request-body";
import {
  appearanceFromStyle,
  styleIdForPreferences,
  type AppearancePreferences,
} from "../../../../src/theme/appearance";
import { isThemeId } from "../../../../src/theme/catalog";
import { mobileAppearancePacks } from "../../../../src/theme/mobile-palette";
import { DEFAULT_STYLE_ID, styleById } from "../../../../src/theme/styles";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function unauthorized() {
  return NextResponse.json(
    { error: { code: "unauthorized", message: "Sign in to sync appearance." } },
    { headers: NO_STORE, status: 401 },
  );
}

function serialize(snapshot: {
  preferences: AppearancePreferences | null;
  updatedAt: Date | null;
}) {
  return {
    preferences: snapshot.preferences,
    updatedAt: snapshot.updatedAt === null ? null : snapshot.updatedAt.toISOString(),
  };
}

/**
 * Mobile BFF read — the user's synced appearance plus every catalog color
 * pack pre-mapped onto the mobile palette contract so "Match web app" can
 * paint a pack without knowing web tokens.
 */
export async function GET(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return unauthorized();
  }
  const snapshot = await getUserAppearance(session.user.id);
  return NextResponse.json(
    { ...serialize(snapshot), packs: mobileAppearancePacks() },
    { headers: NO_STORE },
  );
}

/**
 * `PUT {theme}` — merges a color-pack pick onto the stored prefs (or the
 * DEFAULT_STYLE_ID bundle when none exist). `style` is set to the catalog
 * bundle only while the merged axes still equal it exactly, else `null` —
 * the same custom-mix semantics `currentStyleId()` uses on the web.
 */
export async function PUT(request: Request) {
  const session = await getAuthSession(request.headers);
  if (session === null) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: { code: "validationError", message: "The request body is too large." } },
        { headers: NO_STORE, status: 413 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: { code: "invalidJson", message: "Invalid JSON." } },
        { headers: NO_STORE, status: 400 },
      );
    }
    throw error;
  }

  const theme =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).theme
      : undefined;
  if (typeof theme !== "string" || !isThemeId(theme)) {
    return NextResponse.json(
      { error: { code: "invalidTheme", message: "An unknown color pack." } },
      { headers: NO_STORE, status: 400 },
    );
  }

  const stored = await getUserAppearance(session.user.id);
  const base = stored.preferences ?? appearanceFromStyle(styleById(DEFAULT_STYLE_ID));
  const merged = { ...base, theme };
  const preferences: AppearancePreferences = {
    ...merged,
    style: styleIdForPreferences(merged),
  };
  const saved = await saveUserAppearance(session.user.id, preferences);
  return NextResponse.json(
    { preferences: saved.preferences, updatedAt: saved.updatedAt.toISOString() },
    { headers: NO_STORE },
  );
}
