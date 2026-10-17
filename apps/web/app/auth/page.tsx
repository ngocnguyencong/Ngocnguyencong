import { parsePublicConfig, parseServerConfig } from "@supastack/config";
import { getDictionary, LOCALE_COOKIE, resolveLocale } from "@supastack/i18n";
import { cookies, headers } from "next/headers";

import { AuthJsSignIn } from "../../src/authjs-signin";
import { getRequestBrand } from "../../src/custom-domains/runtime";
import { resolveAnalyticsConfig } from "../../src/analytics";
import { clientCaptureEnabledFor } from "../../src/marketing/marketing-consent";
import { WebAuthPage } from "../../src/web-auth-page";

export const dynamic = "force-dynamic";

export default async function AuthPage() {
  const publicConfig = parsePublicConfig(parseServerConfig());
  const headerList = await headers();
  const jar = await cookies();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const requestOrigin = host ? `${proto}://${host.split(",")[0]!.trim()}` : publicConfig.app.webUrl;
  const locale = resolveLocale([
    jar.get(LOCALE_COOKIE)?.value,
    headerList.get("x-supastack-locale"),
    headerList.get("accept-language"),
  ]);
  const copy = getDictionary(locale).auth;
  const brand = await getRequestBrand(headerList);
  const captureEnabled = clientCaptureEnabledFor(resolveAnalyticsConfig());

  const providers = {
    apple: publicConfig.auth.providers.apple,
    github: publicConfig.auth.providers.github,
    google: publicConfig.auth.providers.google,
    microsoft: publicConfig.auth.providers.microsoft,
    twitter: publicConfig.auth.providers.twitter,
  };

  if (publicConfig.providers.auth === "authjs") {
    return (
      <AuthJsSignIn
        providers={providers}
        brand={brand}
        copy={copy}
        locale={locale}
        captureEnabled={captureEnabled}
      />
    );
  }

  return (
    <WebAuthPage
      apiUrl={requestOrigin}
      brand={brand}
      callbackURL={new URL("/auth", requestOrigin).toString()}
      captchaSiteKey={
        publicConfig.captcha.provider === "turnstile"
          ? publicConfig.captcha.turnstileSiteKey
          : undefined
      }
      providers={providers}
      copy={copy}
      locale={locale}
      captureEnabled={captureEnabled}
    />
  );
}
