import { describe, expect, it, vi } from "vitest";
import {
  leadStatusMessage,
  marketingInboxFromEnv,
  parseContact,
  parseNewsletter,
  submitLead,
} from "./marketing-leads";

describe("parseContact", () => {
  it("trims a valid contact submission", () => {
    expect(
      parseContact({
        name: "  Ada  ",
        email: " ada@example.com ",
        message: "  Hello from a builder.  ",
      }),
    ).toEqual({
      ok: true,
      name: "Ada",
      email: "ada@example.com",
      message: "Hello from a builder.",
    });
  });

  it("rejects missing name, invalid email, and empty message", () => {
    expect(parseContact({ name: " ", email: "ada@example.com", message: "Hi" })).toEqual({
      ok: false,
      error: "name-required",
    });
    expect(parseContact({ name: "Ada", email: "not-an-email", message: "Hi" })).toEqual({
      ok: false,
      error: "invalid-email",
    });
    expect(parseContact({ name: "Ada", email: "ada@example.com", message: "   " })).toEqual({
      ok: false,
      error: "message-required",
    });
  });
});

describe("parseNewsletter", () => {
  it("accepts a trimmed email and never invents a subscriber count", () => {
    expect(parseNewsletter({ email: " ada@example.com " })).toEqual({
      ok: true,
      email: "ada@example.com",
    });
    expect(JSON.stringify(parseNewsletter({ email: "ada@example.com" }))).not.toMatch(
      /subscriber|count/i,
    );
  });
});

describe("submitLead", () => {
  it("returns delivery-not-connected when inbox or send is missing", async () => {
    const parsed = parseContact({
      name: "Ada",
      email: "ada@example.com",
      message: "Hello",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await expect(submitLead(parsed, { kind: "contact" })).resolves.toEqual({
      ok: false,
      error: "delivery-not-connected",
    });
  });

  it("sends a contact message when inbox and send exist", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const parsed = parseContact({
      name: "Ada",
      email: "ada@example.com",
      message: "Need a license question answered.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await expect(
      submitLead(parsed, {
        kind: "contact",
        inbox: "hello@example.com",
        send,
      }),
    ).resolves.toEqual({ ok: true, kind: "contact" });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      to: "hello@example.com",
      subject: "supastack contact from Ada",
    });
    expect(String(send.mock.calls[0]?.[0].text)).toContain("ada@example.com");
  });

  it("sends a newsletter notice without a subscriber count", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const parsed = parseNewsletter({ email: "ada@example.com" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await expect(
      submitLead(parsed, { kind: "newsletter", inbox: "hello@example.com", send }),
    ).resolves.toEqual({ ok: true, kind: "newsletter" });
    expect(JSON.stringify(send.mock.calls[0]?.[0])).not.toMatch(/subscriber count/i);
  });

  it("persists to a store without needing inbox delivery", async () => {
    const store = { save: vi.fn().mockResolvedValue("created") };
    const parsed = parseNewsletter({ email: "ada@example.com" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await expect(submitLead(parsed, { kind: "newsletter", store })).resolves.toEqual({
      ok: true,
      kind: "newsletter",
    });
    expect(store.save).toHaveBeenCalledOnce();
    expect(store.save.mock.calls[0]?.[0]).toMatchObject({
      kind: "newsletter",
      email: "ada@example.com",
    });
  });

  it("persists then notifies when both store and inbox are configured", async () => {
    const calls: string[] = [];
    const store = {
      save: vi.fn().mockImplementation(async () => {
        calls.push("store");
        return "created";
      }),
    };
    const send = vi.fn().mockImplementation(async () => {
      calls.push("send");
    });
    const parsed = parseContact({
      name: "Ada",
      email: "ada@example.com",
      message: "Need a license question answered.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await expect(
      submitLead(parsed, { kind: "contact", inbox: "hello@example.com", send, store }),
    ).resolves.toEqual({ ok: true, kind: "contact" });
    expect(calls).toEqual(["store", "send"]);
  });

  it("treats a duplicate newsletter save as success without notifying again", async () => {
    const store = { save: vi.fn().mockResolvedValue("duplicate") };
    const send = vi.fn().mockResolvedValue(undefined);
    const parsed = parseNewsletter({ email: "ada@example.com" });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    await expect(
      submitLead(parsed, { kind: "newsletter", inbox: "hello@example.com", send, store }),
    ).resolves.toEqual({ ok: true, kind: "newsletter" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("marketingInboxFromEnv", () => {
  it("returns a valid inbox and ignores junk", () => {
    expect(marketingInboxFromEnv({ MARKETING_INBOX: " hello@example.com " })).toBe(
      "hello@example.com",
    );
    expect(marketingInboxFromEnv({ MARKETING_INBOX: "not-an-email" })).toBeUndefined();
    expect(marketingInboxFromEnv({})).toBeUndefined();
  });
});

describe("leadStatusMessage", () => {
  it("explains unconnected delivery without claiming a list size", () => {
    expect(leadStatusMessage("delivery-not-connected", "contact")).toBe(
      "Message delivery is not connected yet.",
    );
    expect(leadStatusMessage("sent", "newsletter")).toBe("Your email was received.");
    expect(leadStatusMessage("invalid-email", "newsletter")).toBe("Enter a valid email address.");
    expect(leadStatusMessage("captcha", "contact")).toBe("Complete the human check and try again.");
    expect(leadStatusMessage("rate-limited", "contact")).toBe(
      "Please wait before sending another message.",
    );
    expect(leadStatusMessage(undefined, "contact")).toBeNull();
  });
});
