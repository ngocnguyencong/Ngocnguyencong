import { CaptchaWidget } from "../captcha-widget";
import { submitContactAction, submitNewsletterAction } from "./leads-actions";
import { leadStatusMessage, type LeadKind } from "./marketing-leads";
import styles from "./utility-page.module.css";

export function ContactPage({
  status,
  form,
  turnstileSiteKey,
}: {
  status?: string | undefined;
  form?: string | undefined;
  turnstileSiteKey?: string | undefined;
}) {
  const kind: LeadKind = form === "newsletter" ? "newsletter" : "contact";
  const message = leadStatusMessage(status, kind);

  return (
    <main id="main" className={styles.main}>
      <header className={styles.intro}>
        <h1>Contact</h1>
        <p>
          Ask about the kit, or leave an email for occasional product notes. No subscriber counts.
        </p>
      </header>
      {message ? (
        <p className={styles.status} role="status">
          {message}
        </p>
      ) : null}
      <div className={styles.forms}>
        <section className={styles.panel} aria-labelledby="contact-heading">
          <h2 id="contact-heading">Write to us</h2>
          <p>Delivery uses the operator inbox only when it is configured.</p>
          <form action={submitContactAction} className={styles.form}>
            <label htmlFor="contact-name">
              Name
              <input autoComplete="name" id="contact-name" name="name" required type="text" />
            </label>
            <label htmlFor="contact-email">
              Email
              <input autoComplete="email" id="contact-email" name="email" required type="email" />
            </label>
            <label htmlFor="contact-message">
              Message
              <textarea id="contact-message" name="message" required rows={6} />
            </label>
            {turnstileSiteKey ? <CaptchaWidget siteKey={turnstileSiteKey} /> : null}
            <button type="submit">Send message</button>
          </form>
        </section>
        <section className={styles.panel} id="newsletter" aria-labelledby="newsletter-heading">
          <h2 id="newsletter-heading">Newsletter</h2>
          <p>Leave an email. We will not invent how many people already did.</p>
          <form action={submitNewsletterAction} className={styles.form}>
            <label htmlFor="newsletter-email">
              Email
              <input
                autoComplete="email"
                id="newsletter-email"
                name="email"
                required
                type="email"
              />
            </label>
            {turnstileSiteKey ? <CaptchaWidget siteKey={turnstileSiteKey} /> : null}
            <button type="submit">Subscribe</button>
          </form>
        </section>
      </div>
    </main>
  );
}
