import type { ReactNode } from "react";
import styles from "./waitlist-band.module.css";

/**
 * Kit block — product waitlist band with referral share loop. Pass your
 * server-action form (email input + submit, plus a captcha widget when you use
 * one) into `children`; the block supplies copy, the status banner after
 * redirect-back, and the shareable-link readout once `shareUrl` is present.
 */
export function WaitlistBand({
  title,
  description,
  kicker,
  status,
  shareUrl,
  shareLabel = "Your invite link",
  children,
}: {
  title: string;
  description?: string | undefined;
  kicker?: string | undefined;
  /** Redirect-back status line — rendered with role="status". */
  status?: ReactNode;
  /** Shareable referral URL shown after a successful join. */
  shareUrl?: string | undefined;
  shareLabel?: string | undefined;
  /** Form slot — typically an inline email input + submit button. */
  children: ReactNode;
}) {
  return (
    <section className={styles.section} id="waitlist">
      <div className={styles.panel}>
        <div className={styles.copy}>
          {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
          <h2 className={styles.title}>{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
          {status ? (
            <p className={styles.status} role="status">
              {status}
            </p>
          ) : null}
        </div>
        <div className={styles.side}>
          <div className={styles.form}>{children}</div>
          {shareUrl ? (
            <p className={styles.share}>
              <span>{shareLabel}</span>
              <code className={styles.shareUrl}>{shareUrl}</code>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
