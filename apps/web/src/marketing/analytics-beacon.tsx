"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { canCaptureAnalytics } from "./marketing-consent";
import { readStoredConsentChoice, useMarketingConsentChoice } from "./use-consent-choice";

const COLLECT_URL = "/api/analytics/collect";
const MAX_EVENT_NAME_LENGTH = 120;

/** Whether the local beacon is armed — the only state `trackEvent` needs. */
let beaconArmed = false;

function postCollect(payload: Record<string, string>): void {
  const body = JSON.stringify(payload);
  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(COLLECT_URL, new Blob([body], { type: "application/json" }))
    ) {
      return;
    }
  } catch {
    /* fall through to the keepalive fetch */
  }
  void fetch(COLLECT_URL, {
    body,
    // No credentials — the collect endpoint is anonymous; cookies must never
    // ride along on the fallback path (sendBeacon can't omit them).
    credentials: "omit",
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

/**
 * Only the referrer host leaves the page — never the full URL, so query
 * strings can't leak identifiers. Malformed referrers are omitted.
 */
function referrerHost(): string | undefined {
  try {
    return document.referrer ? new URL(document.referrer).host : undefined;
  } catch {
    return undefined;
  }
}

/**
 * First-party analytics beacon (ANALYTICS_PROVIDER=local): sends a pageview
 * to /api/analytics/collect on mount and on every client-side navigation
 * while consent stays `accepted`. No cookies, no identifiers — the server
 * derives the daily-rotating visitor hash. Nothing is sent before consent.
 */
export function AnalyticsBeacon({ clientCaptureEnabled }: { clientCaptureEnabled: boolean }) {
  const choice = useMarketingConsentChoice();
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!canCaptureAnalytics({ choice, clientCaptureEnabled })) {
      beaconArmed = false;
      lastTrackedPath.current = null;
      return;
    }
    beaconArmed = true;
    if (lastTrackedPath.current === pathname) {
      return;
    }
    lastTrackedPath.current = pathname;
    const referrer = referrerHost();
    postCollect({
      kind: "pageview",
      path: pathname,
      ...(referrer === undefined ? {} : { referrerHost: referrer }),
    });
  }, [choice, clientCaptureEnabled, pathname]);

  return null;
}

/**
 * Custom events for product code (`trackEvent("cta_clicked")`): under the
 * local provider the beacon posts `{kind:"event"}` to the collect endpoint;
 * under a script provider the call forwards to the loaded vendor global
 * (`posthog.capture` / `plausible`). No-ops during SSR and until consent is
 * accepted — callers never need to check consent themselves.
 */
export function trackEvent(name: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = name.trim().slice(0, MAX_EVENT_NAME_LENGTH);
  if (trimmed === "") {
    return;
  }
  // The stored choice and vendor globals can both throw in locked-down
  // browsers (blocked storage / blocked third-party script) — no-op instead.
  try {
    if (readStoredConsentChoice() !== "accepted") {
      return;
    }
    const posthog = (window as { posthog?: { capture?: (event: string) => void } }).posthog;
    if (typeof posthog?.capture === "function") {
      posthog.capture(trimmed);
      return;
    }
    const plausible = (window as { plausible?: (event: string) => void }).plausible;
    if (typeof plausible === "function") {
      plausible(trimmed);
      return;
    }
    if (beaconArmed) {
      postCollect({ kind: "event", name: trimmed, path: window.location.pathname });
    }
  } catch {
    /* blocked storage or vendor globals — drop the event */
  }
}
