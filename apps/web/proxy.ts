import {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE,
  resolveLocale,
  type AppLocale,
} from "@supastack/i18n";
import { NextResponse, type NextRequest } from "next/server";

import { growthCookiesToSet } from "./src/growth/growth-cookies";

/** Persist ?ref=/?invite= into httpOnly cookies on whichever response leaves. */
function captureGrowthParams(request: NextRequest, response: NextResponse): void {
  for (const spec of growthCookiesToSet(request.nextUrl.searchParams)) {
    response.cookies.set(spec.name, spec.value, spec.options);
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  const pathLocale = isAppLocale(first) ? first : null;

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const headerLocale = request.headers.get("accept-language");
  const locale = resolveLocale([pathLocale, cookieLocale, headerLocale], DEFAULT_LOCALE);

  if (pathLocale === DEFAULT_LOCALE) {
    const rest = pathname.replace(/^\/en(?:\/|$)/, "/") || "/";
    const url = request.nextUrl.clone();
    url.pathname = rest;
    const response = NextResponse.redirect(url);
    if (request.cookies.get(LOCALE_COOKIE)?.value !== DEFAULT_LOCALE) {
      response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    captureGrowthParams(request, response);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-supastack-locale", locale);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  captureGrowthParams(request, response);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|.*\\..*).*)"],
};

export function readLocaleFromHeaders(headers: Headers): AppLocale {
  return resolveLocale([headers.get("x-supastack-locale")], DEFAULT_LOCALE);
}
