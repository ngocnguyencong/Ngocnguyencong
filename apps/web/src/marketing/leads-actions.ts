"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCaptchaVerifier } from "../captcha";
import { marketingPublicWriteAllowed } from "../public-write-admission-runtime";
import { getLeadStore } from "./lead-store";
import { createMarketingSend } from "./marketing-mail";
import {
  marketingInboxFromEnv,
  parseContact,
  parseNewsletter,
  submitLead,
} from "./marketing-leads";

/** FormData values can be File objects; only real strings are accepted. */
function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function contactDestination(status: string, form: "contact" | "newsletter"): string {
  const params = new URLSearchParams({ status });
  if (form === "newsletter") {
    params.set("form", "newsletter");
  }
  return `/contact?${params.toString()}`;
}

/**
 * Bot gate for the public lead forms. No-op unless CAPTCHA_PROVIDER=turnstile —
 * then the Turnstile token in `cf-turnstile-response` must verify.
 */
async function captchaOk(formData: FormData, headerList: Headers): Promise<boolean> {
  const remoteIp = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  return getCaptchaVerifier().verify(formString(formData, "cf-turnstile-response"), remoteIp);
}

export async function submitContactAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  if (!(await captchaOk(formData, requestHeaders))) {
    redirect(contactDestination("captcha", "contact"));
  }
  const parsed = parseContact({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    message: formString(formData, "message"),
  });
  if (!parsed.ok) {
    redirect(contactDestination(parsed.error, "contact"));
  }
  if (!(await marketingPublicWriteAllowed(requestHeaders))) {
    redirect(contactDestination("rate-limited", "contact"));
  }
  const result = await submitLead(parsed, {
    kind: "contact",
    inbox: marketingInboxFromEnv(process.env),
    send: createMarketingSend(),
    store: await getLeadStore(),
  });
  redirect(contactDestination(result.ok ? "sent" : result.error, "contact"));
}

export async function submitNewsletterAction(formData: FormData): Promise<void> {
  const requestHeaders = await headers();
  if (!(await captchaOk(formData, requestHeaders))) {
    redirect(contactDestination("captcha", "newsletter"));
  }
  const parsed = parseNewsletter({
    email: formString(formData, "email"),
  });
  if (!parsed.ok) {
    redirect(contactDestination(parsed.error, "newsletter"));
  }
  if (!(await marketingPublicWriteAllowed(requestHeaders))) {
    redirect(contactDestination("rate-limited", "newsletter"));
  }
  const result = await submitLead(parsed, {
    kind: "newsletter",
    inbox: marketingInboxFromEnv(process.env),
    send: createMarketingSend(),
    store: await getLeadStore(),
  });
  redirect(contactDestination(result.ok ? "sent" : result.error, "newsletter"));
}
