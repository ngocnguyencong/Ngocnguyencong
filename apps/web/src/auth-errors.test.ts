import { getDictionary } from "@supastack/i18n";
import { describe, expect, it } from "vitest";

import { authErrorMessage, type AuthErrorCopy } from "./auth-errors";

const errors: AuthErrorCopy = getDictionary("en").auth.errors;

describe("authErrorMessage", () => {
  it("maps credential failures to invalidCredentials", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, errors)).toBe(
      errors.invalidCredentials,
    );
    expect(authErrorMessage({ code: "USER_NOT_FOUND" }, errors)).toBe(errors.invalidCredentials);
    expect(authErrorMessage({ code: "INVALID_CREDENTIALS" }, errors)).toBe(
      errors.invalidCredentials,
    );
  });

  it("maps bad and expired codes", () => {
    expect(authErrorMessage({ code: "INVALID_OTP" }, errors)).toBe(errors.invalidCode);
    expect(authErrorMessage({ code: "INVALID_CODE" }, errors)).toBe(errors.invalidCode);
    expect(authErrorMessage({ code: "INVALID_TOKEN" }, errors)).toBe(errors.invalidCode);
    expect(authErrorMessage({ code: "OTP_EXPIRED" }, errors)).toBe(errors.expiredCode);
    expect(authErrorMessage({ code: "OTP_HAS_EXPIRED" }, errors)).toBe(errors.expiredCode);
  });

  it("maps rate limiting by code and by HTTP status", () => {
    expect(authErrorMessage({ code: "TOO_MANY_REQUESTS" }, errors)).toBe(errors.tooManyRequests);
    expect(authErrorMessage({ status: 429 }, errors)).toBe(errors.tooManyRequests);
  });

  it("maps unverified email", () => {
    expect(authErrorMessage({ code: "EMAIL_NOT_VERIFIED" }, errors)).toBe(errors.emailNotVerified);
  });

  it("falls back to generic for unknown codes, missing fields, and null", () => {
    expect(authErrorMessage({ code: "SOMETHING_ELSE" }, errors)).toBe(errors.generic);
    expect(authErrorMessage({ message: "Raw server string" }, errors)).toBe(errors.generic);
    expect(authErrorMessage(null, errors)).toBe(errors.generic);
    expect(authErrorMessage(undefined, errors)).toBe(errors.generic);
  });

  it("never leaks the raw server message", () => {
    const raw = { code: "WHAT", message: "Internal DB exploded" };
    expect(authErrorMessage(raw, errors)).not.toContain("Internal DB exploded");
  });
});
