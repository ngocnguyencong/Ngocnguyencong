export const CONSENT_STORAGE_KEY = "supastack-marketing-consent";

/**
 * Same-tab consent-change notification: the banner dispatches this after
 * persisting a choice so mounted analytics islands can react immediately
 * (`storage` events only reach other tabs).
 */
export const CONSENT_CHANGED_EVENT = "supastack:marketing-consent";

export type ConsentChoice = "accepted" | "rejected";

export type ConsentState = {
  clientCaptureEnabled: boolean;
  choice?: ConsentChoice | null | undefined;
};

/**
 * Config-driven capture gate (the old compile-time
 * MARKETING_CLIENT_CAPTURE_ENABLED, now resolved per request from
 * ANALYTICS_PROVIDER): `local` first-party analytics always qualifies — the
 * banner still decides whether events fire — while the script providers only
 * qualify when their ANALYTICS_SITE_ID is configured.
 */
export function clientCaptureEnabledFor(analytics: {
  provider: string;
  siteId?: string | undefined;
}): boolean {
  if (analytics.provider === "local") {
    return true;
  }
  return (
    (analytics.provider === "plausible" || analytics.provider === "posthog") &&
    Boolean(analytics.siteId?.trim())
  );
}

export function shouldShowConsentBanner(input: ConsentState): boolean {
  if (!input.clientCaptureEnabled) {
    return false;
  }
  return input.choice !== "accepted" && input.choice !== "rejected";
}

export function canCaptureAnalytics(input: ConsentState): boolean {
  return input.clientCaptureEnabled && input.choice === "accepted";
}
