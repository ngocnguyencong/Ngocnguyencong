import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";
import { LOCALE_COOKIE } from "@supastack/i18n";

import { proxy, readLocaleFromHeaders } from "../proxy.js";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("i18n proxy", () => {
  it("maintains contract markers in proxy.ts", () => {
    const source = readFileSync(join(webRoot, "proxy.ts"), "utf8");
    expect(source).toContain("x-supastack-locale");
    expect(source).toContain("LOCALE_COOKIE");
    expect(source).toContain("resolveLocale");
  });

  it("sets locale cookie and request header for supported path locales", () => {
    for (const locale of ["de", "es", "fr"] as const) {
      const request = new NextRequest(`https://supastack.test/${locale}/dashboard`);
      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-rewrite") ?? "").not.toContain("404");
      const cookie = response.cookies.get(LOCALE_COOKIE);
      expect(cookie?.value).toBe(locale);
    }
  });

  it("redirects English locale prefix to canonical un-prefixed paths", () => {
    const cases = [
      { from: "https://supastack.test/en", to: "https://supastack.test/" },
      { from: "https://supastack.test/en/dashboard", to: "https://supastack.test/dashboard" },
      {
        from: "https://supastack.test/en/settings/general",
        to: "https://supastack.test/settings/general",
      },
      { from: "https://supastack.test/en/billing", to: "https://supastack.test/billing" },
      { from: "https://supastack.test/en/chat", to: "https://supastack.test/chat" },
    ];

    for (const { from, to } of cases) {
      const request = new NextRequest(from);
      const response = proxy(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(to);
      const cookie = response.cookies.get(LOCALE_COOKIE);
      expect(cookie?.value).toBe("en");
    }
  });

  it("resolves locale from cookie when URL has no prefix", () => {
    const request = new NextRequest("https://supastack.test/dashboard", {
      headers: {
        cookie: `${LOCALE_COOKIE}=de`,
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
  });

  it("resolves locale from Accept-Language header when cookie and prefix are absent", () => {
    const request = new NextRequest("https://supastack.test/chat", {
      headers: {
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    });
    const response = proxy(request);
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(LOCALE_COOKIE);
    expect(cookie?.value).toBe("fr");
  });

  it("defaults to English when no candidate locale matches", () => {
    const request = new NextRequest("https://supastack.test/billing");
    const response = proxy(request);
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(LOCALE_COOKIE);
    expect(cookie?.value).toBe("en");
  });

  it("captures ?ref= and ?invite= into httpOnly growth cookies", () => {
    const request = new NextRequest("https://supastack.test/?ref=Ref42&invite=Code9");
    const response = proxy(request);
    expect(response.cookies.get("supastack_ref")?.value).toBe("ref42");
    expect(response.cookies.get("supastack_invite")?.value).toBe("code9");

    const junk = new NextRequest("https://supastack.test/?ref=<script>");
    expect(proxy(junk).cookies.get("supastack_ref")).toBeUndefined();
  });

  it("reads locale from request headers via readLocaleFromHeaders", () => {
    const headers = new Headers();
    headers.set("x-supastack-locale", "es");
    expect(readLocaleFromHeaders(headers)).toBe("es");

    const empty = new Headers();
    expect(readLocaleFromHeaders(empty)).toBe("en");
  });
});
