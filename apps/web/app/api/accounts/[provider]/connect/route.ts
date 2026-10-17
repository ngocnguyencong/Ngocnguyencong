import { parseServerConfig } from "@supastack/config";
import { NextResponse } from "next/server";

import { prepareConnectedAccountConnect } from "../../../../../src/connected-accounts-runtime";
import {
  oauthStateCookieName,
  oauthStateCookieOptions,
  sanitizeOAuthReturnTo,
} from "../../../../../src/oauth-state";
import { rateLimitResponse } from "../../../../../src/rate-limit-route";
import { oauthConnectLimiter } from "../../../../../src/rate-limit-runtime";
import { requireWorkspaceManager } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ provider: string }> }>;

const serverConfig = parseServerConfig();

/**
 * Starts the OAuth connect flow for a connected account: verifies membership,
 * issues the signed PKCE state cookie, and 302s to the provider authorize URL.
 * Unavailable providers redirect back with a generic status — never an error
 * page carrying provider detail.
 */
export async function GET(request: Request, context: RouteContext) {
  const limited = await rateLimitResponse(request.headers, oauthConnectLimiter, "oauth-connect");
  if (limited !== null) {
    return limited;
  }

  const { provider } = await context.params;
  const url = new URL(request.url);
  const returnTo = sanitizeOAuthReturnTo(url.searchParams.get("returnTo"));
  const origin = new URL(serverConfig.app.webUrl).origin;

  const statusRedirect = (status: string) => {
    const target = new URL(returnTo, origin);
    target.searchParams.set("status", status);
    return NextResponse.redirect(target, 302);
  };

  // Connected accounts are shared workspace infrastructure (gmail.send,
  // dm.write) — connecting one requires the owner/admin gate like api-keys
  // and webhooks, not plain member writes.
  const manager = await requireWorkspaceManager();
  if ("error" in manager) {
    return statusRedirect("error");
  }

  const outcome = prepareConnectedAccountConnect({
    actorUserId: manager.userId,
    origin,
    provider,
    returnTo: url.searchParams.get("returnTo"),
    workspaceId: manager.workspaceId,
  });
  if (outcome.kind !== "authorize") {
    return statusRedirect("unavailable");
  }

  const isProduction = serverConfig.app.environment === "production";
  const response = NextResponse.redirect(outcome.authorizeUrl, 302);
  response.cookies.set(
    oauthStateCookieName(isProduction),
    outcome.cookieValue,
    oauthStateCookieOptions(isProduction),
  );
  return response;
}
