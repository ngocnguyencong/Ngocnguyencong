import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./paywall-gate.module.css";

export type PaywallGateProps = {
  /** Upgrade destination. */
  cta: { href: string; label: string };
  /** Optional teaser sentence merged into the gated-content copy in the panel. */
  excerpt?: string | undefined;
  /** Entitlement/plan label shown in the prompt (e.g. "Pro"). */
  requiredTier: string;
  /** Optional faded preview content (already-safe teaser markup). */
  preview?: ReactNode | undefined;
  /** Optional heading shown in the gate panel. */
  title?: string | undefined;
};

/** Kit block — locked-content teaser with an upgrade CTA. Pairs with gated CMS entries. */
export function PaywallGate({ cta, excerpt, preview, requiredTier, title }: PaywallGateProps) {
  return (
    <section className={styles.gate} aria-label="Locked content">
      {preview !== undefined ? (
        <div className={styles.preview} aria-hidden="true" inert>
          {preview}
        </div>
      ) : null}
      <div className={styles.panel}>
        <span className={styles.icon} aria-hidden="true">
          <Lock size={16} />
        </span>
        {title !== undefined ? <h3 className={styles.title}>{title}</h3> : null}
        <p className={styles.copy}>
          {excerpt !== undefined ? <>{excerpt} </> : null}
          This content is available to {requiredTier} subscribers.
        </p>
        <a className={styles.cta} href={cta.href}>
          {cta.label}
        </a>
      </div>
    </section>
  );
}
