import { resolveAnalyticsConfig } from "../analytics";
import { AnalyticsBeacon } from "./analytics-beacon";
import { AnalyticsScriptClient } from "./analytics-script-client";
import { clientCaptureEnabledFor } from "./marketing-consent";

/**
 * Marketing analytics mount point (server component): resolves the
 * configured ANALYTICS_PROVIDER once per request and renders the matching
 * consent-gated client island — the first-party beacon for `local`, the
 * script injector for `plausible`/`posthog`. Renders nothing while the
 * provider is off or a script provider lacks its site id.
 */
export function MarketingAnalytics() {
  const analytics = resolveAnalyticsConfig();
  if (!clientCaptureEnabledFor(analytics)) {
    return null;
  }
  if (analytics.provider === "local") {
    return <AnalyticsBeacon clientCaptureEnabled />;
  }
  if (analytics.provider === "plausible" || analytics.provider === "posthog") {
    return (
      <AnalyticsScriptClient
        clientCaptureEnabled
        {...(analytics.host ? { host: analytics.host } : {})}
        provider={analytics.provider}
        siteId={analytics.siteId}
      />
    );
  }
  return null;
}
