"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { localePath, type AppLocale } from "@supastack/i18n";
import { Popover } from "./ui/primitives";
import { browserLocale, copyForLocale } from "./ui/ui-copy";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  readAt?: string | null;
  createdAt: string;
};

function notificationItemHref(locale: AppLocale, href: string): string {
  return href.startsWith("/") && !href.startsWith("//") ? localePath(locale, href) : href;
}

export function NotificationBell({
  notificationsHref = "/settings/notifications",
  initialNotifications,
  locale,
}: {
  notificationsHref?: string;
  initialNotifications?: NotificationItem[];
  locale?: AppLocale | undefined;
}) {
  const activeLocale = locale ?? browserLocale();
  const copy = copyForLocale(activeLocale).notifications;
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialNotifications ?? [],
  );
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  useEffect(() => {
    let active = true;
    async function fetchNotifications() {
      try {
        setLoading(true);
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = (await res.json()) as { notifications?: NotificationItem[] };
          if (active && Array.isArray(data.notifications)) {
            setNotifications(data.notifications);
          }
        }
      } catch {
        // Silently tolerate network/offline errors in UI chrome
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchNotifications();
    return () => {
      active = false;
    };
  }, []);

  async function markRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Revert if critical, but in notifications transient failure is fine
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    for (const id of unreadIds) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // ignore
      }
    }
  }

  return (
    <div className="notification-bell">
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={copy.title}
        trigger={
          <button
            type="button"
            className="notification-bell-button"
            aria-label={`${copy.title}${unreadCount > 0 ? `, ${unreadCount} ${copy.unread}` : ""}`}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Bell className="notification-bell-icon" size={20} aria-hidden="true" />
            {unreadCount > 0 ? (
              <span className="notification-bell-badge" aria-hidden="true">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>
        }
      >
        <div className="notification-popover-header">
          <div className="notification-popover-title-row">
            <strong>{copy.title}</strong>
            {unreadCount > 0 ? (
              <span className="notification-popover-count-tag">
                {unreadCount} {copy.new}
              </span>
            ) : null}
          </div>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="notification-popover-action"
              onClick={() => void markAllRead()}
            >
              {copy.markAll}
            </button>
          ) : null}
        </div>

        <div className="notification-popover-body">
          {notifications.length === 0 ? (
            <div className="notification-popover-empty">{loading ? copy.loading : copy.empty}</div>
          ) : (
            <ul className="notification-popover-list">
              {notifications.slice(0, 6).map((item) => {
                const isUnread = !item.readAt;
                return (
                  <li
                    key={item.id}
                    className={`notification-popover-item ${isUnread ? "notification-popover-item-unread" : ""}`}
                  >
                    <div className="notification-popover-item-main">
                      <div className="notification-popover-item-header">
                        {isUnread ? (
                          <span className="notification-unread-dot" aria-hidden="true" />
                        ) : null}
                        <strong className="notification-popover-item-title">{item.title}</strong>
                      </div>
                      <p className="notification-popover-item-body">{item.body}</p>
                      {item.href ? (
                        <a
                          href={notificationItemHref(activeLocale, item.href)}
                          className="notification-popover-item-link"
                          onClick={() => setOpen(false)}
                        >
                          {copy.viewAll}
                        </a>
                      ) : null}
                    </div>
                    {isUnread ? (
                      <button
                        type="button"
                        className="notification-popover-mark-btn"
                        title={copy.markRead}
                        aria-label={copy.markRead}
                        onClick={() => void markRead(item.id)}
                      >
                        <Check aria-hidden="true" size={16} />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="notification-popover-footer">
          <a
            href={notificationsHref}
            className="notification-popover-footer-link"
            onClick={() => setOpen(false)}
          >
            {copy.viewAll}
          </a>
        </div>
      </Popover>
    </div>
  );
}
