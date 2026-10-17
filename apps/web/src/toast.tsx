"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

import { CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { getDictionary, isAppLocale, LOCALE_COOKIE } from "@supastack/i18n";
import { motionTokens } from "@supastack/design-tokens";
import { reducedMotion } from "./ui/primitives";

import styles from "./toast.module.css";

export type ToastKind = "info" | "success" | "error";

export type ToastItem = Readonly<{
  id: number;
  kind: ToastKind;
  message: string;
  persistent: boolean;
}>;

export type ToastOptions = Readonly<{ durationMs?: number; persistent?: boolean }>;

const MAX_TOASTS = 4;
const DEFAULT_DURATION_MS = 5000;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

/** Exported for tests and non-React integrations; Toaster subscribes internally. */
export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Exported for tests; the immutable snapshot keeps useSyncExternalStore stable. */
export function getToastSnapshot(): ToastItem[] {
  return toasts;
}

function getServerSnapshot(): ToastItem[] {
  return toasts;
}

function dismiss(id: number) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

function show(message: string, kind: ToastKind, options: ToastOptions = {}) {
  const id = nextId++;
  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS;
  const persistent = options.persistent ?? (kind === "error" || durationMs <= 0);
  toasts = [...toasts, { id, kind, message, persistent }];
  while (toasts.length > MAX_TOASTS) {
    const oldest = toasts.find((item) => !item.persistent);
    if (!oldest) break;
    const timer = timers.get(oldest.id);
    if (timer) clearTimeout(timer);
    timers.delete(oldest.id);
    toasts = toasts.filter((item) => item.id !== oldest.id);
  }
  if (!persistent && toasts.some((item) => item.id === id))
    timers.set(
      id,
      setTimeout(() => dismiss(id), durationMs),
    );
  emit();
  return id;
}

export const toast = {
  info: (message: string, options?: ToastOptions) => show(message, "info", options),
  success: (message: string, options?: ToastOptions) => show(message, "success", options),
  error: (message: string, options?: ToastOptions) => show(message, "error", options),
  dismiss,
};

const KIND_ICON: Record<ToastKind, typeof Info> = {
  error: OctagonAlert,
  info: Info,
  success: CheckCircle2,
};

function localeFromCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Global toast viewport — mount once at the body level (root layout). The
 * dismiss label self-localizes from the locale cookie post-hydration (same
 * pattern as the language switcher); pass `dismissLabel` to pin a label.
 */
export function Toaster({ dismissLabel }: { dismissLabel?: string | undefined }) {
  const items = useSyncExternalStore(subscribeToasts, getToastSnapshot, getServerSnapshot);
  const [label, setLabel] = useState(dismissLabel ?? "Dismiss");
  const [displayed, setDisplayed] = useState<readonly (ToastItem & { exiting?: boolean })[]>(items);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rects = useRef(new Map<string, number>());
  useEffect(() => {
    const live = new Set(items.map((item) => item.id));
    setDisplayed((previous) => [
      ...previous.filter((item) => !live.has(item.id)).map((item) => ({ ...item, exiting: true })),
      ...items,
    ]);
    const timer = setTimeout(
      () => setDisplayed((previous) => previous.filter((item) => !item.exiting)),
      reducedMotion() ? 0 : motionTokens.exit,
    );
    return () => clearTimeout(timer);
  }, [items]);
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const node of viewportRef.current?.querySelectorAll<HTMLElement>("[data-toast-id]") ??
      []) {
      const id = node.dataset.toastId!;
      const top = node.getBoundingClientRect().top;
      const previous = rects.current.get(id);
      if (
        previous !== undefined &&
        previous !== top &&
        !reducedMotion() &&
        typeof node.animate === "function"
      ) {
        node.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "none" }], {
          duration: motionTokens.enter,
          easing: "cubic-bezier(0.16,1,0.3,1)",
        });
      }
      next.set(id, top);
    }
    rects.current = next;
  }, [displayed]);

  useEffect(() => {
    if (dismissLabel !== undefined) {
      setLabel(dismissLabel);
      return;
    }
    const locale = localeFromCookie();
    if (isAppLocale(locale)) {
      setLabel(getDictionary(locale).common.dismiss);
    }
  }, [dismissLabel]);

  return (
    <div className={styles.viewport} ref={viewportRef}>
      <div className="visually-hidden" role="status">
        {items
          .filter((item) => item.kind !== "error")
          .map((item) => item.message)
          .join(". ")}
      </div>
      <div className="visually-hidden" role="alert">
        {items
          .filter((item) => item.kind === "error")
          .map((item) => item.message)
          .join(". ")}
      </div>
      {displayed.map((item) => {
        const Icon = KIND_ICON[item.kind];
        return (
          <div
            className={`${styles.item} ${styles[item.kind]}`}
            key={item.id}
            data-toast-id={item.id}
            data-state={item.exiting ? "closed" : "open"}
            aria-hidden={item.exiting || undefined}
            inert={item.exiting || undefined}
          >
            <Icon aria-hidden="true" className={styles.icon} size={18} strokeWidth={2.2} />
            <p className={styles.message}>{item.message}</p>
            <button
              aria-label={label}
              className={styles.close}
              onClick={() => dismiss(item.id)}
              type="button"
            >
              <X aria-hidden="true" size={15} strokeWidth={2.4} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
