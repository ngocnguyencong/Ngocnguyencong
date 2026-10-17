// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  isPending: true,
  data: null as null | { user: { id: string; email: string; name: string } },
}));
vi.mock("../web-auth-client", () => ({ createWebAuthClient: () => ({ useSession: () => state }) }));
vi.mock("./faq-browser", () => ({ FaqWidget: () => null }));
import type { SiteHeaderClient as HeaderComponent } from "./site-header-client";
let SiteHeaderClient: typeof HeaderComponent;
// Fresh modules per test — the browser document's confirmed-session cache is
// module-scoped, and each test simulates a fresh page load.
beforeEach(async () => {
  vi.resetModules();
  ({ SiteHeaderClient } = await import("./site-header-client"));
});
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  state.isPending = true;
  state.data = null;
});
it("resolves actions once and preserves Dashboard during background checks", async () => {
  window.matchMedia = (media) =>
    ({
      matches: false,
      media,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  const view = document.createElement("div");
  const root = createRoot(view);
  const render = async () => {
    await act(async () => root.render(<SiteHeaderClient locale="en" />));
  };
  try {
    await render();
    expect(view.querySelector('a[href="/auth"]')).toBeNull();
    state.isPending = false;
    await render();
    expect(view.querySelectorAll('a[href="/auth"]')).toHaveLength(2);
    state.data = { user: { id: "viewer", name: "Viewer", email: "viewer@example.com" } };
    await render();
    expect(view.querySelectorAll('a[href="/dashboard"]')).toHaveLength(2);
    state.isPending = true;
    state.data = null;
    await render();
    expect(view.querySelectorAll('a[href="/dashboard"]')).toHaveLength(2);
    expect(view.querySelector('a[href="/auth"]')).toBeNull();
    state.isPending = false;
    await render();
    expect(view.querySelectorAll('a[href="/auth"]')).toHaveLength(2);
  } finally {
    act(() => root.unmount());
  }
});

it("renders the seeded signed-in action on the first paint while the session resolves", async () => {
  window.matchMedia = (media) =>
    ({
      matches: false,
      media,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  const view = document.createElement("div");
  const root = createRoot(view);
  try {
    await act(async () =>
      root.render(<SiteHeaderClient locale="en" viewer={{ signedIn: true }} />),
    );
    expect(view.querySelectorAll('a[href="/dashboard"]')).toHaveLength(2);
    expect(view.querySelector('a[href="/auth"]')).toBeNull();
  } finally {
    act(() => root.unmount());
  }
});

it("renders the seeded guest action on the first paint while the session resolves", async () => {
  window.matchMedia = (media) =>
    ({
      matches: false,
      media,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  const view = document.createElement("div");
  const root = createRoot(view);
  try {
    await act(async () =>
      root.render(<SiteHeaderClient locale="en" viewer={{ signedIn: false }} />),
    );
    expect(view.querySelectorAll('a[href="/auth"]')).toHaveLength(2);
    expect(view.querySelector('a[href="/dashboard"]')).toBeNull();
  } finally {
    act(() => root.unmount());
  }
});

it("lets the resolved client session replace a stale signed-in snapshot", async () => {
  window.matchMedia = (media) =>
    ({
      matches: false,
      media,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  const view = document.createElement("div");
  const root = createRoot(view);
  const render = async () => {
    await act(async () =>
      root.render(<SiteHeaderClient locale="en" viewer={{ signedIn: true }} />),
    );
  };
  try {
    await render();
    expect(view.querySelectorAll('a[href="/dashboard"]')).toHaveLength(2);
    state.isPending = false;
    state.data = null;
    await render();
    expect(view.querySelector('a[href="/dashboard"]')).toBeNull();
    expect(view.querySelectorAll('a[href="/auth"]')).toHaveLength(2);
  } finally {
    act(() => root.unmount());
  }
});

it("renders the seeded action into SSR markup", () => {
  const html = renderToString(<SiteHeaderClient locale="en" viewer={{ signedIn: true }} />);
  expect(html).toContain('href="/dashboard"');
});
