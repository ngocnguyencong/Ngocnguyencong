import styles from "./cta-band.module.css";

/** Kit block — raised call-to-action band for the bottom of a marketing page. */
export function CtaBand({
  title,
  text,
  cta,
}: {
  title: string;
  text?: string | undefined;
  cta: { href: string; label: string };
}) {
  return (
    <section className={styles.section}>
      <div className={styles.band}>
        <h2 className={styles.title}>{title}</h2>
        {text ? <p className={styles.text}>{text}</p> : null}
        <a className={styles.cta} href={cta.href}>
          {cta.label}
        </a>
      </div>
    </section>
  );
}
