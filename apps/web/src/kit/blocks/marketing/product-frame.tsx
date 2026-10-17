import type { ReactNode } from "react";

import styles from "./product-frame.module.css";

export type ProductFrameTab = {
  label: string;
  /** Marks the tab as the current view (hairline ring + ink text). */
  active?: boolean | undefined;
};

/**
 * Kit block — product frame: the minimal style's only elevated object.
 * Two chrome variants: "browser" (three dots + a centred URL pill) and
 * "app" (a flat app-window titlebar — leading brand slot plus an optional
 * segmented tab strip). `status` renders a hairline status strip at the
 * bottom of the frame. Reuse it for any screenshot/vignette that should
 * float above the ruled page.
 */
export function ProductFrame({
  url,
  chrome = "browser",
  brand,
  tabs,
  status,
  children,
  className,
}: {
  /** Optional URL shown in the chrome pill (browser chrome only). */
  url?: string | undefined;
  /** "browser" = fake browser bar; "app" = flat app-window titlebar. */
  chrome?: "browser" | "app" | undefined;
  /** Leading slot in the app titlebar — e.g. a small product mark + wordmark. */
  brand?: ReactNode;
  /** Segmented nav strip in the app titlebar; `active` marks the open view. */
  tabs?: readonly ProductFrameTab[] | undefined;
  /** Status strip rendered at the bottom edge of the frame. */
  status?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <div className={[styles.frame, className].filter(Boolean).join(" ")} data-chrome={chrome}>
      {chrome === "app" ? (
        <div className={styles.appBar}>
          {brand ? <div className={styles.appBrand}>{brand}</div> : null}
          {tabs && tabs.length > 0 ? (
            <div className={styles.appTabs}>
              {tabs.map((tab) => (
                <span
                  className={styles.appTab}
                  data-active={tab.active || undefined}
                  key={tab.label}
                >
                  {tab.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.chrome}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {url ? <span className={styles.url}>{url}</span> : null}
        </div>
      )}
      <div className={styles.body}>{children}</div>
      {status ? <div className={styles.statusBar}>{status}</div> : null}
    </div>
  );
}
