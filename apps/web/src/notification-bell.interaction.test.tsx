// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "./notification-bell";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const items = [
  {
    id: "members",
    title: "Membership changed",
    body: "A member joined the workspace.",
    href: "/settings/members",
    createdAt: "2026-10-07T12:00:00.000Z",
  },
  {
    id: "external",
    title: "Read the guide",
    body: "A guide is available.",
    href: "https://example.test/guide",
    createdAt: "2026-10-07T12:01:00.000Z",
  },
  {
    id: "anchor",
    title: "Jump to details",
    body: "Details are below.",
    href: "#details",
    createdAt: "2026-10-07T12:02:00.000Z",
  },
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
});

describe("NotificationBell item destinations", () => {
  it("localizes internal app paths and preserves external and hash-only links", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <NotificationBell
          initialNotifications={items}
          locale="de"
          notificationsHref="/de/settings/notifications"
        />,
      );
      await Promise.resolve();
    });

    const trigger = container.querySelector<HTMLButtonElement>(".notification-bell-button");
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger?.click();
      await Promise.resolve();
    });

    const hrefs = [
      ...container.querySelectorAll<HTMLAnchorElement>(".notification-popover-item-link"),
    ].map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/de/settings/members", "https://example.test/guide", "#details"]);
  });
});
