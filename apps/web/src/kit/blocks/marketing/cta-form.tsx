import { ArrowRight } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

import styles from "./cta-form.module.css";

/**
 * Kit block — closing CTA: centred title + sub, then the product's own
 * form in the children slot, then a small muted note. Compose the form
 * from CtaForm.Input / CtaForm.Button so it matches the pill grammar
 * (44px height, radius 999, black primary) without forking styles.
 */
function CtaFormBase({
  title,
  sub,
  children,
  note,
}: {
  title: string;
  sub?: string | undefined;
  children: ReactNode;
  note?: string | undefined;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.wrap}>
        <h2 className={styles.title}>{title}</h2>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
        <div className={styles.form}>{children}</div>
        {note ? <p className={styles.note}>{note}</p> : null}
      </div>
    </section>
  );
}

function CtaInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={styles.input} {...props} />;
}

function CtaButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={styles.button} type="submit" {...props}>
      {children}
    </button>
  );
}

/** Secondary text action for the form row — e.g. "Or read the docs". */
function CtaLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a className={styles.tlink} href={href}>
      {children}
      <ArrowRight aria-hidden="true" className={styles.arrow} size={15} strokeWidth={2.2} />
    </a>
  );
}

export const CtaForm = Object.assign(CtaFormBase, {
  Input: CtaInput,
  Button: CtaButton,
  Link: CtaLink,
});
