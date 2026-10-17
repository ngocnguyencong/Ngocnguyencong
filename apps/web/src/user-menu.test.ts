// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.unstubAllGlobals());
describe("UserMenu", () => {
  it("localizes actions, exposes the email and restores keyboard focus", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { email: "builder@example.test", name: "Builder" } }),
      }),
    );
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => root.render(createElement(UserMenu, { locale: "fr" })));
      const trigger = host.querySelector("button")!;
      void act(() => trigger.click());
      expect(host.textContent).toContain("builder@example.test");
      expect(host.textContent).toContain("Se déconnecter");
      expect(host.querySelector("a")).toBeNull();
      void act(() =>
        host
          .querySelector('[role="dialog"]')!
          .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
      );
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(trigger);
    } finally {
      void act(() => root.unmount());
      host.remove();
    }
  });
});
