"use client";

import { useEffect, useRef } from "react";

import { canCaptureAnalytics } from "./marketing-consent";
import { useMarketingConsentChoice } from "./use-consent-choice";

const PLAUSIBLE_DEFAULT_HOST = "https://plausible.io";
const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

type PosthogGlobal = {
  init?: (siteId: string, options: Record<string, unknown>) => void;
  opt_out_capturing?: () => void;
  reset?: () => void;
};

/**
 * Official posthog-js snippet: installs the `window.posthog` stub, queues
 * calls, and lazily pulls `/static/array.js` from the configured api_host —
 * no npm dependency, and nothing loads before consent.
 */
const POSTHOG_SNIPPET = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(t=e.createElement("script")).type="text/javascript",t.crossOrigin="anonymous",t.async=!0,t.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=e.getElementsByTagName("script")[0]).parentNode.insertBefore(t,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags onFeatureFlags onSessionId identify setPersonProperties group resetGroups reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);`;

/**
 * Third-party analytics injector for the plausible/posthog providers.
 * Renders nothing and injects nothing until consent resolves to `accepted`;
 * a later accept loads the vendor script without a reload. `rejected`
 * (and every other state) loads nothing, ever — and when consent leaves
 * `accepted` after injection, the effect cleanup opts PostHog out + resets
 * it, removes the Plausible script node, and drops the vendor global so
 * capture actually stops and a re-accept can re-inject cleanly.
 */
export function AnalyticsScriptClient({
  clientCaptureEnabled,
  host,
  provider,
  siteId,
}: {
  clientCaptureEnabled: boolean;
  host?: string | undefined;
  provider: "plausible" | "posthog";
  siteId: string;
}) {
  const choice = useMarketingConsentChoice();
  const injectedRef = useRef(false);

  useEffect(() => {
    if (injectedRef.current || !canCaptureAnalytics({ choice, clientCaptureEnabled })) {
      return;
    }
    injectedRef.current = true;

    if (provider === "plausible") {
      const script = document.createElement("script");
      script.defer = true;
      script.dataset.domain = siteId;
      script.src = `${host ?? PLAUSIBLE_DEFAULT_HOST}/js/script.js`;
      document.head.appendChild(script);
      return () => {
        injectedRef.current = false;
        script.remove();
        try {
          delete (window as { plausible?: unknown }).plausible;
        } catch {
          /* the vendor global may be absent or non-configurable */
        }
      };
    }

    const loader = document.createElement("script");
    loader.text = POSTHOG_SNIPPET;
    document.head.appendChild(loader);
    try {
      const posthog = (window as { posthog?: PosthogGlobal }).posthog;
      posthog?.init?.(siteId, { api_host: host ?? POSTHOG_DEFAULT_HOST });
    } catch {
      /* a blocked third-party script never breaks the page */
    }
    return () => {
      injectedRef.current = false;
      loader.remove();
      try {
        const posthog = (window as { posthog?: PosthogGlobal }).posthog;
        posthog?.opt_out_capturing?.();
        posthog?.reset?.();
        delete (window as { posthog?: unknown }).posthog;
      } catch {
        /* the vendor global may be absent or blocked */
      }
    };
  }, [choice, clientCaptureEnabled, host, provider, siteId]);

  return null;
}
