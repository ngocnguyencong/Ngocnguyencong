"use client";

import { useState } from "react";

import styles from "./setup-page.module.css";

/**
 * Progressive-enhancement copy control for setup fix commands — renders a
 * plain button that copies via the clipboard API and reports briefly; when
 * the clipboard is unavailable it stays inert (the <code> block next to it
 * remains selectable without JavaScript).
 */
export function SetupCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={styles.copyButton}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
