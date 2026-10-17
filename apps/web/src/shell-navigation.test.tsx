// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellNavigation } from "./shell-navigation";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./ui/primitives", () => ({
  Sheet: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) =>
    open ? (
      <div role="dialog">
        <button onClick={() => onOpenChange(false)}>Close</button>
        {children}
      </div>
    ) : null,
}));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});
const sidebar = (
  <nav>
    <a href="/dashboard">Dashboard</a>
    <button>Sign out</button>
  </nav>
);
describe("ShellNavigation", () => {
  it("closes the drawer across viewport changes without duplicating navigation", () => {
    let narrow = true;
    let refresh = () => {};
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return narrow;
      },
      addEventListener(_event: string, fn: () => void) {
        refresh = fn;
      },
      removeEventListener() {},
    }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() =>
        root.render(
          <ShellNavigation brand={<a href="/">Demo</a>} sidebar={sidebar}>
            <main>Content</main>
          </ShellNavigation>,
        ),
      );
      act(() => host.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')!.click());
      expect(host.querySelectorAll('a[href="/dashboard"]')).toHaveLength(1);
      narrow = false;
      act(() => refresh());
      expect(host.querySelector("aside")).not.toBeNull();
      narrow = true;
      act(() => refresh());
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
  it("keeps navigation in server markup before enhancement", () => {
    const html = renderToStaticMarkup(
      <ShellNavigation brand={<a href="/">Demo</a>} sidebar={sidebar}>
        <main>Content</main>
      </ShellNavigation>,
    );
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Sign out");
    expect(html).toContain('data-shell-ready="false"');
  });
  it("uses a compact mobile drawer and preserves its navigation actions", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      void act(() =>
        root.render(
          <ShellNavigation brand={<a href="/">Demo</a>} sidebar={sidebar}>
            <main>Content</main>
          </ShellNavigation>,
        ),
      );
      expect(host.querySelector("aside")).toBeNull();
      const opener = host.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]')!;
      void act(() => opener.click());
      expect(host.querySelector('[role="dialog"]')?.textContent).toContain("Sign out");
      void act(() => host.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
      expect(host.querySelector('[role="dialog"]')).toBeNull();
    } finally {
      void act(() => root.unmount());
      host.remove();
    }
  });
  it("persists collapsed sidebar state without changing the layout choice", () => {
    document.documentElement.dataset.layout = "collapsible";
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      void act(() =>
        root.render(
          <ShellNavigation brand={<a href="/">Demo</a>} sidebar={sidebar}>
            <main>Content</main>
          </ShellNavigation>,
        ),
      );
      void act(() =>
        host.querySelector<HTMLButtonElement>('[aria-label="Collapse sidebar"]')!.click(),
      );
      expect(
        host.querySelector("[data-sidebar-collapsed]")?.getAttribute("data-sidebar-collapsed"),
      ).toBe("true");
      expect(localStorage.getItem("supastack-sidebar-collapsed")).toBe("true");
      expect(document.documentElement.dataset.layout).toBe("collapsible");
    } finally {
      void act(() => root.unmount());
      host.remove();
      delete document.documentElement.dataset.layout;
    }
  });
});
