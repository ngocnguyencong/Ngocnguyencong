// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { writeConsentChoice } from "./use-consent-choice";
import { AnalyticsScriptClient } from "./analytics-script-client";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(element: ReactElement): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

function plausibleScript(): HTMLScriptElement | null {
  return document.head.querySelector<HTMLScriptElement>("script[data-domain]");
}

function injectedScripts(): HTMLScriptElement[] {
  return Array.from(document.head.querySelectorAll("script"));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  writeConsentChoice(null);
  localStorage.clear();
  for (const script of injectedScripts()) {
    script.remove();
  }
  delete (window as { plausible?: unknown }).plausible;
  delete (window as { posthog?: unknown }).posthog;
});

describe("AnalyticsScriptClient", () => {
  it("injects nothing before consent or when rejected", () => {
    mount(
      <AnalyticsScriptClient clientCaptureEnabled provider="plausible" siteId="example.test" />,
    );
    expect(injectedScripts()).toHaveLength(0);

    act(() => writeConsentChoice("rejected"));
    expect(injectedScripts()).toHaveLength(0);
  });

  it("injects the plausible tag once accepted and removes it on withdrawal", () => {
    mount(
      <AnalyticsScriptClient clientCaptureEnabled provider="plausible" siteId="example.test" />,
    );
    act(() => writeConsentChoice("accepted"));

    const script = plausibleScript();
    expect(script?.src).toBe("https://plausible.io/js/script.js");
    expect(script?.dataset.domain).toBe("example.test");
    (window as { plausible?: unknown }).plausible = vi.fn();

    act(() => writeConsentChoice("rejected"));

    expect(plausibleScript()).toBeNull();
    expect((window as { plausible?: unknown }).plausible).toBeUndefined();
  });

  it("honors a configured ANALYTICS_HOST origin", () => {
    mount(
      <AnalyticsScriptClient
        clientCaptureEnabled
        host="https://analytics.example"
        provider="plausible"
        siteId="example.test"
      />,
    );
    act(() => writeConsentChoice("accepted"));

    expect(plausibleScript()?.src).toBe("https://analytics.example/js/script.js");
  });

  it("re-injects cleanly when consent is re-accepted", () => {
    mount(
      <AnalyticsScriptClient clientCaptureEnabled provider="plausible" siteId="example.test" />,
    );
    act(() => writeConsentChoice("accepted"));
    expect(plausibleScript()).not.toBeNull();

    act(() => writeConsentChoice("rejected"));
    expect(plausibleScript()).toBeNull();

    act(() => writeConsentChoice("accepted"));
    expect(plausibleScript()).not.toBeNull();
    expect(document.head.querySelectorAll("script[data-domain]")).toHaveLength(1);
  });

  it("opts PostHog out and resets the global on withdrawal", () => {
    mount(<AnalyticsScriptClient clientCaptureEnabled provider="posthog" siteId="phc_x" />);
    act(() => writeConsentChoice("accepted"));

    expect(injectedScripts().length).toBeGreaterThan(0);
    const posthog = { opt_out_capturing: vi.fn(), reset: vi.fn() };
    (window as { posthog?: unknown }).posthog = posthog;

    act(() => writeConsentChoice("rejected"));

    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.reset).toHaveBeenCalledTimes(1);
    expect((window as { posthog?: unknown }).posthog).toBeUndefined();
  });
});
