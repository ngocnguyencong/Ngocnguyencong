// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollEndCta } from "./scroll-end-cta";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let view: HTMLDivElement;
let show: ReturnType<typeof vi.fn>;

const PROPS = {
  body: "Questions before you build?",
  primary: { href: "/contact", label: "Get in touch", hint: "We read every message" },
  secondary: { href: "/docs", label: "Read the docs", hint: "Guides and examples" },
  title: "Still exploring?",
};

function mount(props: Partial<Parameters<typeof ScrollEndCta>[0]> = {}) {
  view = document.createElement("div");
  document.body.appendChild(view);
  root = createRoot(view);
  act(() => root.render(<ScrollEndCta {...PROPS} {...props} />));
}
function advance(ms: number) {
  void act(() => {
    vi.advanceTimersByTime(ms);
  });
}
function visibility(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  void act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
function scrollTo(scrollY: number, scrollHeight = 4000, innerHeight = 900) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: innerHeight });
  Object.defineProperty(window, "scrollY", { configurable: true, value: scrollY });
  void act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  visibility(false);
  scrollTo(0, 4000, 900);
  show = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: show,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});
afterEach(() => {
  act(() => root?.unmount());
  view?.remove();
  document.body.style.overflow = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scroll-end cta", () => {
  it("opens the labelled dialog at the end of the page, once per session", () => {
    mount();
    scrollTo(1200);
    expect(show).not.toHaveBeenCalled();
    scrollTo(3100);
    expect(show).toHaveBeenCalledTimes(1);
    const dialog = view.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(dialog.querySelector('a[href="/contact"]')).not.toBeNull();
    expect(dialog.querySelector('a[href="/docs"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    act(() => (dialog.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click());
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    act(() => root.unmount());
    view.remove();
    mount();
    scrollTo(3100);
    advance(90_000);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("falls back to the dwell timer when the visitor never scrolls", () => {
    mount();
    advance(89_999);
    expect(show).not.toHaveBeenCalled();
    advance(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("honors a custom delay and ignores bottom-at-mount pages", () => {
    scrollTo(0, 800, 900);
    mount({ delayMs: 5_000 });
    void act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(show).not.toHaveBeenCalled();
    advance(5_000);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("counts visible time only", () => {
    mount();
    advance(10_000);
    visibility(true);
    advance(90_000);
    expect(show).not.toHaveBeenCalled();
    visibility(false);
    advance(79_999);
    expect(show).not.toHaveBeenCalled();
    advance(1);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab and Shift+Tab inside the modal controls", () => {
    mount();
    scrollTo(3100);
    const dialog = view.querySelector("dialog")!;
    const controls = dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    expect(last.getAttribute("href")).toBe("/docs");
    first.focus();
    act(() => {
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(last);
    act(() => {
      last.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(first);
  });

  it("defers while a form or another dialog has focus", () => {
    mount();
    const other = document.createElement("dialog");
    other.setAttribute("open", "");
    document.body.appendChild(other);
    scrollTo(3100);
    advance(90_000);
    expect(show).not.toHaveBeenCalled();
    other.remove();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    advance(2_000);
    expect(show).not.toHaveBeenCalled();
    input.remove();
    advance(1_000);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("still works if session storage is unavailable and cleans up on unmount", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    scrollTo(3100);
    expect(show).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(document.body.style.overflow).toBe("");
    advance(90_000);
    expect(show).toHaveBeenCalledTimes(1);
    // Avoid a second unmount of the already disposed root.
    root = undefined as unknown as Root;
  });

  it("renders the panel inline in preview mode with no dialog behavior", () => {
    mount({ preview: true });
    scrollTo(3100);
    advance(90_000);
    expect(show).not.toHaveBeenCalled();
    expect(view.querySelector("dialog")).toBeNull();
    expect(view.textContent).toContain("Still exploring?");
    expect(view.querySelector('a[href="/contact"]')).not.toBeNull();
  });
});
