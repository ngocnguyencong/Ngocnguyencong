export type LeadKind = "contact" | "newsletter";

export type ContactFields = {
  name: string;
  email: string;
  message: string;
};

export type NewsletterFields = {
  email: string;
};

export type LeadError =
  | "captcha"
  | "invalid-email"
  | "message-required"
  | "name-required"
  | "delivery-not-connected"
  | "rate-limited";

export type ParsedContact = { ok: true } & ContactFields;
export type ParsedNewsletter = { ok: true } & NewsletterFields;
export type LeadParseFailure = {
  ok: false;
  error: Exclude<LeadError, "delivery-not-connected" | "rate-limited">;
};
export type LeadSubmitResult = { ok: true; kind: LeadKind } | { ok: false; error: LeadError };

export type MarketingSendInput = {
  to: string;
  subject: string;
  text: string;
};

export type LeadRecord = {
  kind: LeadKind;
  email: string;
  name?: string;
  message?: string;
  receivedAt: string;
};

export type LeadSaveResult = "created" | "duplicate";

/**
 * Persistence boundary for marketing leads — implemented in
 * `lead-store.ts` (server-only). Newsletter leads dedupe by email;
 * contact leads always create a new record.
 */
export interface LeadStore {
  save(lead: LeadRecord): Promise<LeadSaveResult>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return null;
  }
  return email;
}

export function marketingInboxFromEnv(
  environment: Record<string, string | undefined> = {},
): string | undefined {
  const inbox = parseEmail(environment.MARKETING_INBOX ?? "");
  return inbox ?? undefined;
}

export function parseContact(input: ContactFields): ParsedContact | LeadParseFailure {
  const name = input.name.trim();
  const email = parseEmail(input.email);
  const message = input.message.trim();
  if (!name) {
    return { ok: false, error: "name-required" };
  }
  if (!email) {
    return { ok: false, error: "invalid-email" };
  }
  if (!message) {
    return { ok: false, error: "message-required" };
  }
  return { ok: true, name: name.slice(0, 120), email, message: message.slice(0, 5000) };
}

export function parseNewsletter(input: NewsletterFields): ParsedNewsletter | LeadParseFailure {
  const email = parseEmail(input.email);
  if (!email) {
    return { ok: false, error: "invalid-email" };
  }
  return { ok: true, email };
}

export async function submitLead(
  parsed: ParsedContact | ParsedNewsletter,
  options: {
    kind: LeadKind;
    inbox?: string | undefined;
    send?: ((message: MarketingSendInput) => Promise<void>) | undefined;
    store?: LeadStore | undefined;
  },
): Promise<LeadSubmitResult> {
  const hasDelivery = Boolean(options.inbox && options.send);
  if (!options.store && !hasDelivery) {
    return { ok: false, error: "delivery-not-connected" };
  }

  if (options.store) {
    const record: LeadRecord = {
      kind: options.kind,
      email: parsed.email,
      receivedAt: new Date().toISOString(),
      ...(options.kind === "contact" && "name" in parsed
        ? { name: parsed.name, message: parsed.message }
        : {}),
    };
    const saveResult = await options.store.save(record);
    if (saveResult === "duplicate") {
      return { ok: true, kind: options.kind };
    }
  }

  if (!options.inbox || !options.send) {
    return { ok: true, kind: options.kind };
  }

  if (options.kind === "newsletter") {
    const email = "email" in parsed ? parsed.email : "";
    await options.send({
      to: options.inbox,
      subject: "supastack newsletter request",
      text: `Newsletter request from ${email}`,
    });
    return { ok: true, kind: "newsletter" };
  }

  const contact = parsed as ParsedContact;
  await options.send({
    to: options.inbox,
    subject: `supastack contact from ${contact.name}`,
    text: `From: ${contact.name} <${contact.email}>\n\n${contact.message}`,
  });
  return { ok: true, kind: "contact" };
}

export function leadStatusMessage(status: string | undefined, kind: LeadKind): string | null {
  if (!status) {
    return null;
  }
  if (status === "sent") {
    return kind === "newsletter" ? "Your email was received." : "Your message was sent.";
  }
  if (status === "delivery-not-connected") {
    return "Message delivery is not connected yet.";
  }
  if (status === "captcha") {
    return "Complete the human check and try again.";
  }
  if (status === "rate-limited") {
    return "Please wait before sending another message.";
  }
  if (status === "invalid-email") {
    return "Enter a valid email address.";
  }
  if (status === "name-required") {
    return "Enter your name.";
  }
  if (status === "message-required") {
    return "Enter a message.";
  }
  return null;
}
