import { afterEach, describe, expect, it, vi } from "vitest";

import { runThemeTransition } from "./theme-transition";

function fakeTransition() {
  return {
    finished: Promise.resolve(),
    ready: Promise.resolve(),
    skipTransition: vi.fn(),
    updateCallbackDone: Promise.resolve(),
  };
}

/**
 * Tests run in the node env (no DOM), so every browser global the helper
 * touches is stubbed here: `document` (+ `documentElement.animate` and
 * `startViewTransition`), `matchMedia`, and the viewport dimensions.
 */
function stubBrowser({
  reducedMotion = false,
  withViewTransition = true,
}: { reducedMotion?: boolean; withViewTransition?: boolean } = {}) {
  const animate = vi.fn();
  const startViewTransition = vi.fn<(callback: () => void) => ReturnType<typeof fakeTransition>>(
    () => fakeTransition(),
  );
  vi.stubGlobal("document", {
    documentElement: { animate },
    ...(withViewTransition ? { startViewTransition } : {}),
  });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: reducedMotion }));
  vi.stubGlobal("innerWidth", 1024);
  vi.stubGlobal("innerHeight", 768);
  return { animate, startViewTransition };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runThemeTransition", () => {
  it("applies synchronously when there is no document (SSR)", () => {
    const apply = vi.fn();
    runThemeTransition(apply, { x: 10, y: 20 });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("applies synchronously when startViewTransition is unavailable", () => {
    const { startViewTransition } = stubBrowser({ withViewTransition: false });
    const apply = vi.fn();
    runThemeTransition(apply, { x: 10, y: 20 });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("applies synchronously when no origin is given", () => {
    const { startViewTransition } = stubBrowser();
    const apply = vi.fn();
    runThemeTransition(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("bypasses the transition for prefers-reduced-motion", () => {
    const { startViewTransition } = stubBrowser({ reducedMotion: true });
    const apply = vi.fn();
    runThemeTransition(apply, { x: 10, y: 20 });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(startViewTransition).not.toHaveBeenCalled();
  });

  it("runs apply inside the startViewTransition update callback", () => {
    const { startViewTransition } = stubBrowser();
    let update: (() => void) | undefined;
    startViewTransition.mockImplementation((callback: () => void) => {
      update = callback;
      return fakeTransition();
    });
    const apply = vi.fn();
    runThemeTransition(apply, { x: 10, y: 20 });
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    update?.();
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("animates a clip-path circle on ::view-transition-new(root)", async () => {
    const { animate, startViewTransition } = stubBrowser();
    startViewTransition.mockImplementation((callback: () => void) => {
      callback();
      return fakeTransition();
    });
    runThemeTransition(vi.fn(), { x: 10, y: 20 });
    await vi.waitFor(() => {
      expect(animate).toHaveBeenCalledTimes(1);
    });
    const farthest = Math.hypot(Math.max(10, 1024 - 10), Math.max(20, 768 - 20));
    expect(animate).toHaveBeenCalledWith(
      {
        clipPath: ["circle(0px at 10px 20px)", `circle(${farthest}px at 10px 20px)`],
      },
      {
        duration: 550,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });

  it("swallows rejected ready/finished promises without throwing", async () => {
    const { animate, startViewTransition } = stubBrowser();
    startViewTransition.mockImplementation((callback: () => void) => {
      callback();
      return {
        finished: Promise.reject(new Error("skipped")),
        ready: Promise.reject(new Error("skipped")),
        skipTransition: vi.fn(),
        updateCallbackDone: Promise.reject(new Error("skipped")),
      };
    });
    expect(() => {
      runThemeTransition(vi.fn(), { x: 1, y: 1 });
    }).not.toThrow();
    // Flush the rejection handlers; an unhandled rejection would fail the run.
    await Promise.resolve();
    await Promise.resolve();
    expect(animate).not.toHaveBeenCalled();
  });
});
