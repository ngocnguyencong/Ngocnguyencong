// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { APPEARANCE_UPDATED_AT_KEY, markAppearanceChanged } from "./appearance";
import { AppearanceSync } from "./appearance-sync";

const REMOTE_PREFERENCES = {
  style: null,
  theme: "paper",
  density: "compact",
  radius: "sharp",
  font: "geometric",
  layout: "topnav",
  toastStyle: "outline",
};
const REMOTE_STAMP = "2026-11-02T10:00:00.000Z";

type FetchCall = { init: { body?: string; method?: string } | undefined; url: string };

function stubFetch(handler: (call: FetchCall) => { payload: unknown; ok?: boolean }) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init?: { body?: string; method?: string }) => {
    const call: FetchCall = { init, url: String(url) };
    calls.push(call);
    const result = handler(call);
    return { json: async () => result.payload, ok: result.ok ?? true };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<AppearanceSync />));
  return {
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe("AppearanceSync", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const attribute of [
      "data-theme",
      "data-density",
      "data-radius",
      "data-font",
      "data-layout",
      "data-toast-style",
    ]) {
      document.documentElement.removeAttribute(attribute);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("applies the server snapshot when the server is newer", async () => {
    const { calls } = stubFetch(() => ({
      payload: { preferences: REMOTE_PREFERENCES, updatedAt: REMOTE_STAMP },
    }));
    const view = mount();
    try {
      await flush();
      expect(document.documentElement.dataset.theme).toBe("paper");
      expect(document.documentElement.dataset.layout).toBe("topnav");
      expect(localStorage.getItem(APPEARANCE_UPDATED_AT_KEY)).toBe(
        String(Date.parse(REMOTE_STAMP)),
      );
      expect(calls.filter((call) => call.init?.method === "PUT")).toHaveLength(0);
    } finally {
      view.unmount();
    }
  });

  it("pushes the local snapshot when the local stamp is newer", async () => {
    const localStamp = Date.parse(REMOTE_STAMP) + 60_000;
    localStorage.setItem(APPEARANCE_UPDATED_AT_KEY, String(localStamp));
    document.documentElement.dataset.theme = "obsidian";
    const { calls } = stubFetch(() => ({
      payload: { preferences: REMOTE_PREFERENCES, updatedAt: REMOTE_STAMP },
    }));
    const view = mount();
    try {
      await flush();
      const puts = calls.filter((call) => call.init?.method === "PUT");
      expect(puts).toHaveLength(1);
      const body = JSON.parse(puts[0]!.init!.body!) as { preferences: { theme: string } };
      expect(body.preferences.theme).toBe("obsidian");
      // The server accepted — its stamp becomes the local stamp.
      expect(localStorage.getItem(APPEARANCE_UPDATED_AT_KEY)).toBe(
        String(Date.parse(REMOTE_STAMP)),
      );
      expect(document.documentElement.dataset.theme).toBe("obsidian");
    } finally {
      view.unmount();
    }
  });

  it("debounces a local change event into a single PUT", async () => {
    vi.useFakeTimers();
    const { calls } = stubFetch(() => ({ payload: { preferences: null, updatedAt: null } }));
    const view = mount();
    try {
      await vi.advanceTimersByTimeAsync(0);
      markAppearanceChanged();
      markAppearanceChanged();
      await vi.advanceTimersByTimeAsync(799);
      expect(calls.filter((call) => call.init?.method === "PUT")).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(2);
      expect(calls.filter((call) => call.init?.method === "PUT")).toHaveLength(1);
    } finally {
      view.unmount();
    }
  });

  it("stays silent when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    const view = mount();
    try {
      await flush();
      expect(document.documentElement.dataset.theme).toBeUndefined();
    } finally {
      view.unmount();
    }
  });
});
