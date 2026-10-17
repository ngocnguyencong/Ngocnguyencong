"use client";

import type { AppLocale } from "@supastack/i18n";
import { useEffect, useState } from "react";

import { copyForLocale } from "../ui/ui-copy";
import { shouldShowConsentBanner, type ConsentChoice } from "./marketing-consent";
import { useMarketingConsentChoice, writeConsentChoice } from "./use-consent-choice";
import styles from "./consent-banner.module.css";

export function ConsentBanner({
  clientCaptureEnabled,
  locale = "en",
}: {
  clientCaptureEnabled: boolean;
  locale?: AppLocale;
}) {
  const choice = useMarketingConsentChoice();
  // The stored choice lives in localStorage, so the banner stays unmounted
  // until the first client effect reads it — SSR never flashes a banner at
  // returning visitors who already decided.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !shouldShowConsentBanner({ choice, clientCaptureEnabled })) {
    return null;
  }

  const copy = copyForLocale(locale).consent;

  function choose(next: ConsentChoice) {
    writeConsentChoice(next);
  }

  return (
    <div className={styles.banner} role="dialog" aria-labelledby="consent-title">
      <p id="consent-title">{copy.title}</p>
      <p>{copy.body}</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => choose("rejected")}>
          {copy.reject}
        </button>
        <button type="button" onClick={() => choose("accepted")}>
          {copy.accept}
        </button>
      </div>
    </div>
  );
}

/**
 * The consent-withdrawal affordance: a quiet text control in the footer that
 * clears the stored choice so the banner re-opens and the visitor can change
 * their decision. Renders only when analytics capture is configured — when
 * the provider is off there is nothing to consent to.
 */
export function ConsentPreferencesButton({
  clientCaptureEnabled,
  label,
}: {
  clientCaptureEnabled: boolean;
  label: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || !clientCaptureEnabled) {
    return null;
  }

  return (
    <button className={styles.preferences} type="button" onClick={() => writeConsentChoice(null)}>
      {label}
    </button>
  );
}
