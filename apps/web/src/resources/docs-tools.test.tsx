// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DocsMotion } from "./docs-tools";
import styles from "./resources.module.css";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
describe("DocsMotion", () => {
  it("retains replacement state when canceled animations finish asynchronously", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const previousAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    const animations: {
      oncancel: (() => void) | null;
      onfinish: (() => void) | null;
      cancel: ReturnType<typeof vi.fn>;
    }[] = [];
    HTMLElement.prototype.animate = vi.fn(() => {
      const animation = {
        oncancel: null,
        onfinish: null,
        cancel: vi.fn(),
      } as (typeof animations)[number];
      animation.cancel = vi.fn(() => queueMicrotask(() => animation.oncancel?.()));
      animations.push(animation);
      return animation as unknown as Animation;
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      void act(() =>
        root.render(
          <>
            <DocsMotion />
            <details className={styles.navGroup} open>
              <summary>Group</summary>
              <div>Links</div>
            </details>
          </>,
        ),
      );
      const summary = host.querySelector("summary")!,
        details = host.querySelector("details")!;
      void act(() => summary.click());
      expect(details.dataset.state).toBe("closing");
      await act(async () => {
        summary.click();
        await Promise.resolve();
      });
      expect(details.dataset.state).toBe("opening");
      await act(async () => {
        summary.click();
        await Promise.resolve();
      });
      expect(details.dataset.state).toBe("closing");
      void act(() => animations[2]!.onfinish?.());
      expect(details.open).toBe(false);
      expect(details.dataset.state).toBeUndefined();
    } finally {
      void act(() => root.unmount());
      host.remove();
      if (previousAnimate) Object.defineProperty(HTMLElement.prototype, "animate", previousAnimate);
      else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
      vi.unstubAllGlobals();
    }
  });
});
