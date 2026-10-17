import { parseServerConfig } from "@supastack/config";
import { NextResponse } from "next/server";

import { handleConnectedAccountCallback } from "../../../../../src/connected-accounts-runtime";
import {
  DEFAULT_OAUTH_RETURN_TO,
  oauthStateCookieName,
  readCookieValue,
} from "../../../../../src/oauth-state";
import { rateLimitResponse } from "../../../../../src/rate-limit-route";
import { oauthCallbackLimiter } from "../../../../../src/rate-limit-runtime";
import { requireWorkspaceManager } from "../../../../../src/workspace-access";

export const runtime = "nodejs";

type RouteContext = Readonly<{ params: Promise<{ provider: string }> }>;

const serverConfig = parseServerConfig();

/**
 * Completes the OAuth connect flow: verifies the signed state cookie against
 * the echoed `state` param, exchanges the code, stores the encrypted token
 * envelope, and redirects back to the page that started the flow. The state
 * cookie is always cleared; failures surface only as `?status=` values.
 */
export async function GET(request: Request, context: RouteContext) {
  const limited = await rateLimitResponse(request.headers, oauthCallbackLimiter, "oauth-callback");
  if (limited !== null) {
    return limited;
  }

  const { provider } = await context.params;
  const url = new URL(request.url);
  const origin = new URL(serverConfig.app.webUrl).origin;
  const isProduction = serverConfig.app.environment === "production";
  const stateCookieValue = readCookieValue(
    request.headers.get("cookie"),
    oauthStateCookieName(isProduction),
  );

  const redirectWithStatus = (returnTo: string, status: string) => {
    const target = new URL(returnTo, origin);
    target.searchParams.set("status", status);
    const response = NextResponse.redirect(target, 302);
    // The state cookie is single-use — clear it on every outcome.
    response.cookies.delete(oauthStateCookieName(isProduction));
    return response;
  };

  // Same manager gate as connect — the callback completes a workspace-level
  // credential change, not a per-member preference.
  const manager = await requireWorkspaceManager();
  if ("error" in manager) {
    return redirectWithStatus(DEFAULT_OAUTH_RETURN_TO, "error");
  }

  const outcome = await handleConnectedAccountCallback({
    actorUserId: manager.userId,
    code: url.searchParams.get("code"),
    origin,
    provider,
    providerError: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
    stateCookieValue,
    workspaceId: manager.workspaceId,
  });
  return redirectWithStatus(outcome.returnTo, outcome.status);
}
