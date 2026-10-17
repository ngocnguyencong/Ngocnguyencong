import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");

function readWeb(relativePath: string): string {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("header notification bell and popover", () => {
  it("implements NotificationBell client component with unread counter and popover", () => {
    const src = readWeb("src/notification-bell.tsx");
    expect(src).toContain('"use client"');
    expect(src).toContain("export function NotificationBell");
    expect(src).toContain("notification-bell-badge");
    expect(src).toContain("notification-popover");
    expect(src).toContain("notification-popover-header");
    expect(src).toContain("notification-popover-empty");
    expect(src).toContain("notification-popover-footer");
  });

  it("handles unread counter, badge, and optimistic mark read", () => {
    const src = readWeb("src/notification-bell.tsx");
    expect(src).toContain("unreadCount");
    expect(src).toContain("markRead");
    expect(src).toContain("markAllRead");
    expect(src).toContain('method: "PATCH"');
    expect(src).toContain('aria-haspopup="dialog"');
    expect(src).toContain("aria-expanded={open}");
  });

  it("supports keyboard dismiss via Escape and outside click dismiss", () => {
    const src = readWeb("src/notification-bell.tsx");
    expect(src).toContain("<Popover");
    const primitive = readWeb("src/ui/primitives.tsx");
    expect(primitive).toContain('event.key === "Escape"');
    expect(primitive).toContain('document.addEventListener("pointerdown", close)');
  });

  it("provides view all notifications link to notificationsHref", () => {
    const src = readWeb("src/notification-bell.tsx");
    expect(src).toContain("{copy.viewAll}");
    expect(readWeb("src/ui/ui-copy.ts")).toContain('viewAll: "View all notifications"');
    expect(src).toContain("href={notificationsHref}");
  });
});
