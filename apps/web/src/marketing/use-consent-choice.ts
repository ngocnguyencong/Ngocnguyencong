"use client";

import { useSyncExternalStore } from "react";

import {
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  type ConsentChoice,
} from "./marketing-consent";

/**
 * In-tab fallback for browsers that block `localStorage` (SecurityError on
 * read, SecurityError/quota on write): once any storage access throws, the
 * store flips to memory so the banner still works and never crashes the
 * marketing render. The choice just stops persisting across loads.
 */
let memoryChoice: ConsentChoice | null = null;
let storageFailed = false;

/** The persisted consent choice — null when undecided or off-window. */
export function readStoredConsentChoice(): ConsentChoice | null {
  if (typeof window === "undefined" || storageFailed) {
    return memoryChoice;
  }
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "accepted" || value === "rejected" ? value : memoryChoice;
  } catch {
    storageFailed = true;
    return memoryChoice;
  }
}

/**
 * Persists a consent choice (`null` clears it → undecided, so the banner
 * re-opens) and notifies same-tab islands. Storage failures degrade to the
 * in-memory value; the change event always dispatches so React state stays
 * consistent either way.
 */
export function writeConsentChoice(choice: ConsentChoice | null): void {
  if (typeof window === "undefined") {
    return;
  }
  memoryChoice = choice;
  try {
    if (choice === null) {
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    }
  } catch {
    storageFailed = true;
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

function subscribeConsent(callback: () => void): () => void {
  // Writes dispatch CONSENT_CHANGED_EVENT in this tab; `storage`
  // covers choices made in other tabs.
  window.addEventListener(CONSENT_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * The persisted marketing-consent choice, kept in sync with banner actions in
 * this tab and with `localStorage` changes from other tabs. The server
 * snapshot is always `null` (undecided) so SSR and hydration agree; the real
 * stored value lands on the first client read.
 */
export function useMarketingConsentChoice(): ConsentChoice | null {
  return useSyncExternalStore(subscribeConsent, readStoredConsentChoice, () => null);
}
