// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  isPending: true,
  error: null as Error | null,
  data: null as null | { user: { id: string; email: string; name: string } },
}));
vi.mock("./web-auth-client", () => ({
  createWebAuthClient: vi.fn(() => ({ useSession: () => state })),
}));
import { useCachedSession } from "./use-cached-session";
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
it("waits initially, caches across refetch/remount, and changes on sign-out or account switch", async () => {
  const view = document.createElement("div");
  let root = createRoot(view);
  function Probe() {
    const session = useCachedSession();
    return (
      <span>
        {session === undefined ? "loading" : session === null ? "guest" : session.user.id}
      </span>
    );
  }
  const render = async () => {
    await act(async () => root.render(<Probe />));
  };
  try {
    await render();
    expect(view.textContent).toBe("loading");
    state.isPending = false;
    await render();
    expect(view.textContent).toBe("guest");
    state.data = { user: { id: "first", email: "first@example.com", name: "First" } };
    await render();
    expect(view.textContent).toBe("first");
    state.isPending = true;
    state.data = null;
    await render();
    expect(view.textContent).toBe("first");
    act(() => root.unmount());
    root = createRoot(view);
    await render();
    expect(view.textContent).toBe("first");
    state.isPending = false;
    state.error = new Error("offline");
    await render();
    expect(view.textContent).toBe("first");
    state.error = null;
    state.data = { user: { id: "second", email: "second@example.com", name: "Second" } };
    await render();
    expect(view.textContent).toBe("second");
    state.data = null;
    await render();
    expect(view.textContent).toBe("guest");
  } finally {
    act(() => root.unmount());
  }
});
