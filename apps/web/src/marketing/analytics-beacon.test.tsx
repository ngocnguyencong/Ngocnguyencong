// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_STORAGE_KEY } from "./marketing-consent";
import { writeConsentChoice } from "./use-consent-choice";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { AnalyticsBeacon, trackEvent } from "./analytics-beacon";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let sendBeacon: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function mount(element: ReactElement): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(element));
  return container;
}

async function beaconPayloads(): Promise<Record<string, string>[]> {
  const payloads: Record<string, string>[] = [];
  for (const call of sendBeacon.mock.calls) {
    const data = call[1] as Blob;
    payloads.push(JSON.parse(await data.text()) as Record<string, string>);
  }
  return payloads;
}

beforeEach(() => {
  localStorage.clear();
  sendBeacon = vi.fn(() => true);
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: sendBeacon,
    writable: true,
  });
  fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  writeConsentChoice(null);
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (window.navigator as { sendBeacon?: unknown }).sendBeacon;
});

describe("AnalyticsBeacon consent gating", () => {
  it("sends nothing before a consent choice exists", () => {
    mount(<AnalyticsBeacon clientCaptureEnabled />);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing when consent was rejected", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "rejected");
    mount(<AnalyticsBeacon clientCaptureEnabled />);
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing while capture is disabled even when accepted", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled={false} />);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("posts a pageview once consent is accepted", async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled />);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe("/api/analytics/collect");
    const [payload] = await beaconPayloads();
    expect(payload).toMatchObject({ kind: "pageview", path: "/" });
    expect(payload).not.toHaveProperty("name");
  });

  it("reacts to a same-tab consent change — accepted arms the beacon", async () => {
    mount(<AnalyticsBeacon clientCaptureEnabled />);
    expect(sendBeacon).not.toHaveBeenCalled();

    act(() => writeConsentChoice("accepted"));

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [payload] = await beaconPayloads();
    expect(payload).toMatchObject({ kind: "pageview", path: "/" });
  });

  it("stops tracking and disarms trackEvent when consent is withdrawn", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled />);
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    act(() => writeConsentChoice("rejected"));
    sendBeacon.mockClear();

    trackEvent("after_withdrawal");
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the referrer host — never the full URL", async () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue(
      "https://news.example/article?utm=secret&id=1",
    );
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled />);

    const [payload] = await beaconPayloads();
    expect(payload?.referrerHost).toBe("news.example");
    expect(JSON.stringify(payload)).not.toContain("utm=secret");
  });

  it("omits the referrer when document.referrer is malformed", async () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue(":::not a url:::");
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled />);

    const [payload] = await beaconPayloads();
    expect(payload).not.toHaveProperty("referrerHost");
  });

  it("trackEvent posts an event through the armed beacon", async () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled />);
    sendBeacon.mockClear();

    trackEvent("cta_click");

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [payload] = await beaconPayloads();
    expect(payload).toMatchObject({ kind: "event", name: "cta_click" });
  });

  it("trackEvent no-ops without accepted consent", () => {
    mount(<AnalyticsBeacon clientCaptureEnabled />);
    trackEvent("cta_click");
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("falls back to fetch with credentials omitted when sendBeacon fails", async () => {
    sendBeacon.mockReturnValue(false);
    localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    mount(<AnalyticsBeacon clientCaptureEnabled />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics/collect",
      expect.objectContaining({ credentials: "omit", method: "POST" }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("keeps consent in memory and does not crash when storage is blocked", async () => {
    // SecurityError-style block: every storage access throws.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access is denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Access is denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Access is denied", "SecurityError");
    });

    mount(<AnalyticsBeacon clientCaptureEnabled />);
    expect(sendBeacon).not.toHaveBeenCalled();

    act(() => writeConsentChoice("accepted"));
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    trackEvent("still_works");
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });
});
