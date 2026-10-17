import { describe, expect, it } from "vitest";
import {
  canCaptureAnalytics,
  clientCaptureEnabledFor,
  shouldShowConsentBanner,
} from "./marketing-consent";

describe("clientCaptureEnabledFor", () => {
  it("is off by default and always enabled for the local provider", () => {
    expect(clientCaptureEnabledFor({ provider: "off" })).toBe(false);
    expect(clientCaptureEnabledFor({ provider: "local" })).toBe(true);
  });

  it("enables script providers only when their site id is configured", () => {
    expect(clientCaptureEnabledFor({ provider: "plausible" })).toBe(false);
    expect(clientCaptureEnabledFor({ provider: "plausible", siteId: "example.test" })).toBe(true);
    expect(clientCaptureEnabledFor({ provider: "posthog" })).toBe(false);
    expect(clientCaptureEnabledFor({ provider: "posthog", siteId: "  " })).toBe(false);
    expect(clientCaptureEnabledFor({ provider: "posthog", siteId: "phc_example" })).toBe(true);
  });
});

describe("marketing consent", () => {
  it("hides the banner unless client analytics would fire", () => {
    expect(shouldShowConsentBanner({ choice: null, clientCaptureEnabled: false })).toBe(false);
    expect(shouldShowConsentBanner({ choice: null, clientCaptureEnabled: true })).toBe(true);
    expect(shouldShowConsentBanner({ choice: "accepted", clientCaptureEnabled: true })).toBe(false);
    expect(shouldShowConsentBanner({ choice: "rejected", clientCaptureEnabled: true })).toBe(false);
  });

  it("captures only when capture is enabled AND consent was accepted", () => {
    expect(canCaptureAnalytics({ choice: "accepted", clientCaptureEnabled: true })).toBe(true);
    expect(canCaptureAnalytics({ choice: "rejected", clientCaptureEnabled: true })).toBe(false);
    expect(canCaptureAnalytics({ choice: null, clientCaptureEnabled: true })).toBe(false);
    // A stored "accepted" must never unlock capture while the provider is off.
    expect(canCaptureAnalytics({ choice: "accepted", clientCaptureEnabled: false })).toBe(false);
  });
});
