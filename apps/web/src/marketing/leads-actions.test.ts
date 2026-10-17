import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admission: vi.fn(async () => true),
  send: vi.fn(async () => {}),
  verify: vi.fn(async () => true),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.10" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`redirect:${destination}`);
  },
}));
vi.mock("../captcha", () => ({ getCaptchaVerifier: () => ({ verify: mocks.verify }) }));
vi.mock("../rate-limit-runtime", () => ({
  marketingLeadGlobalLimiter: { check: vi.fn(async () => ({ allowed: true })) },
}));
vi.mock("../public-write-admission-runtime", () => ({
  marketingPublicWriteAllowed: mocks.admission,
}));
vi.mock("./lead-store", () => ({ getLeadStore: async () => undefined }));
vi.mock("./marketing-mail", () => ({ createMarketingSend: () => mocks.send }));

import { submitContactAction, submitNewsletterAction } from "./leads-actions";

function contact(): FormData {
  const form = new FormData();
  form.set("name", "Ada");
  form.set("email", "ada@example.test");
  form.set("message", "Hello");
  return form;
}

beforeEach(() => {
  vi.stubEnv("MARKETING_INBOX", "team@example.test");
  mocks.admission.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const mock of Object.values(mocks)) mock.mockClear();
});

describe("public lead submission limits", () => {
  it("blocks contact mail when shared public-write admission is exhausted", async () => {
    mocks.admission.mockResolvedValue(false);

    await expect(submitContactAction(contact())).rejects.toThrow(
      "redirect:/contact?status=rate-limited",
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.admission).toHaveBeenCalledTimes(1);
  });

  it("blocks newsletter mail when shared public-write admission is exhausted", async () => {
    mocks.admission.mockResolvedValue(false);
    const form = new FormData();
    form.set("email", "ada@example.test");

    await expect(submitNewsletterAction(form)).rejects.toThrow(
      "redirect:/contact?status=rate-limited&form=newsletter",
    );
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.admission).toHaveBeenCalledTimes(1);
  });

  it("keeps a valid contact submission deliverable", async () => {
    await expect(submitContactAction(contact())).rejects.toThrow("redirect:/contact?status=sent");
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "team@example.test" }));
    expect(mocks.admission).toHaveBeenCalledTimes(1);
  });
});
