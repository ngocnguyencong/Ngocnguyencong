"use client";

import { useEffect } from "react";

import {
  APPEARANCE_CHANGE_EVENT,
  applyAppearanceSnapshot,
  parseAppearancePreferences,
  readAppearanceSnapshot,
  readAppearanceUpdatedAt,
  writeAppearanceUpdatedAt,
} from "./appearance";

const PUSH_DEBOUNCE_MS = 800;

type AppearanceWireResponse = { preferences?: unknown; updatedAt?: unknown };

function responseStamp(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/**
 * Cross-device appearance sync for the signed-in app chrome (mounted inside
 * `WorkspaceShell`; marketing pages never call the API). On mount it GETs the
 * server snapshot: a newer server wins and is applied without animation;
 * otherwise a newer local stamp (or an empty server row) pushes the local
 * snapshot up. Every `supastack:appearance-change` event debounces into a
 * PUT. All failures are silent — sync is best-effort and never blocks or
 * toasts.
 */
export function AppearanceSync() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function pushSnapshot(): Promise<void> {
      if (cancelled || navigator.onLine === false) {
        return;
      }
      try {
        const response = await fetch("/api/account/appearance", {
          body: JSON.stringify({ preferences: readAppearanceSnapshot() }),
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          method: "PUT",
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as AppearanceWireResponse;
        const stamp = responseStamp(payload.updatedAt);
        if (stamp !== null && !cancelled) {
          writeAppearanceUpdatedAt(stamp);
        }
      } catch {
        // Best-effort sync — never surface failures.
      }
    }

    async function boot(): Promise<void> {
      try {
        const response = await fetch("/api/account/appearance", {
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (!response.ok || cancelled) {
          return;
        }
        const payload = (await response.json()) as AppearanceWireResponse;
        const remote = parseAppearancePreferences(payload.preferences);
        const remoteStamp = responseStamp(payload.updatedAt);
        const localStamp = readAppearanceUpdatedAt();
        if (remote !== null && (localStamp === null || (remoteStamp ?? 0) > localStamp)) {
          applyAppearanceSnapshot(remote, remoteStamp ?? undefined);
          return;
        }
        if (
          localStamp !== null &&
          (remote === null || remoteStamp === null || localStamp > remoteStamp)
        ) {
          await pushSnapshot();
        }
      } catch {
        // Best-effort sync — never surface failures.
      }
    }

    function onLocalChange() {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void pushSnapshot();
      }, PUSH_DEBOUNCE_MS);
    }

    window.addEventListener(APPEARANCE_CHANGE_EVENT, onLocalChange);
    void boot();
    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, onLocalChange);
    };
  }, []);

  return null;
}
