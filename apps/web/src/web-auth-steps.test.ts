import { getDictionary } from "@supastack/i18n";
import { describe, expect, it } from "vitest";

import {
  AUTH_STEPS,
  authStepTitle,
  authStepVisibility,
  reduceAuthStep,
  type AuthStep,
} from "./web-auth-steps.js";

const PANEL_KEYS = [
  "choose",
  "otpEmail",
  "otpVerify",
  "setPassword",
  "magicLinkEmail",
  "magicLinkSent",
  "signedIn",
] as const;

function panelKeyForStep(step: AuthStep): (typeof PANEL_KEYS)[number] {
  switch (step) {
    case "otp-email":
      return "otpEmail";
    case "otp-verify":
      return "otpVerify";
    case "set-password":
      return "setPassword";
    case "magic-link-email":
      return "magicLinkEmail";
    case "magic-link-sent":
      return "magicLinkSent";
    case "signed-in":
      return "signedIn";
    default:
      return "choose";
  }
}

function visiblePanels(step: AuthStep) {
  const visibility = authStepVisibility(step);
  return PANEL_KEYS.filter((key) => visibility[key]);
}

describe("auth step visibility", () => {
  it("exposes exactly one primary panel for every signed-out and signed-in step", () => {
    for (const step of AUTH_STEPS) {
      expect(visiblePanels(step), step).toEqual([panelKeyForStep(step)]);
    }
  });

  it("keeps reset steps absent and adds a password step after verified signup", () => {
    expect(AUTH_STEPS).toContain("set-password");
    expect(AUTH_STEPS).not.toContain("password");
    expect(AUTH_STEPS).not.toContain("reset-request");
    expect(AUTH_STEPS).not.toContain("reset-confirm");
  });

  it("names each step for accessible headings", () => {
    const titles = getDictionary("en").auth.stepTitles;
    expect(authStepTitle("choose", titles)).toMatch(/sign in/i);
    expect(authStepTitle("otp-email", titles)).toMatch(/email/i);
    expect(authStepTitle("otp-verify", titles)).toMatch(/code/i);
    expect(authStepTitle("set-password", titles)).toMatch(/password/i);
    expect(authStepTitle("magic-link-email", titles)).toMatch(/link/i);
    expect(authStepTitle("magic-link-sent", titles)).toMatch(/check|email|link/i);
    expect(authStepTitle("signed-in", titles)).toMatch(/ready|account/i);
  });
});

describe("auth step transitions", () => {
  it("moves choose → otp-email → otp-verify and back to choose", () => {
    expect(reduceAuthStep("choose", { type: "select-otp" })).toBe("otp-email");
    expect(reduceAuthStep("otp-email", { type: "otp-sent" })).toBe("otp-verify");
    expect(reduceAuthStep("otp-verify", { type: "back" })).toBe("choose");
    expect(reduceAuthStep("otp-email", { type: "back" })).toBe("choose");
  });

  it("moves choose → magic-link-email → magic-link-sent and back to choose", () => {
    expect(reduceAuthStep("choose", { type: "select-magic-link" })).toBe("magic-link-email");
    expect(reduceAuthStep("magic-link-email", { type: "magic-link-sent" })).toBe("magic-link-sent");
    expect(reduceAuthStep("magic-link-sent", { type: "back" })).toBe("choose");
    expect(reduceAuthStep("magic-link-email", { type: "back" })).toBe("choose");
  });

  it("keeps signup password creation behind OTP verification", () => {
    expect(reduceAuthStep("choose", { type: "select-sign-up" })).toBe("otp-email");
    expect(reduceAuthStep("otp-email", { type: "otp-sent" })).toBe("otp-verify");
    expect(reduceAuthStep("otp-verify", { type: "otp-verified" })).toBe("set-password");
    expect(reduceAuthStep("choose", { type: "otp-verified" })).toBe("choose");
    expect(reduceAuthStep("set-password", { type: "password-created" })).toBe("signed-in");
    expect(reduceAuthStep("set-password", { type: "back" })).toBe("signed-in");
  });

  it("treats back as a no-op on choose and signed-in", () => {
    expect(reduceAuthStep("choose", { type: "back" })).toBe("choose");
    expect(reduceAuthStep("signed-in", { type: "back" })).toBe("signed-in");
  });
});
