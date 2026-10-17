import { describe, expect, it, vi } from "vitest";

import type { WebAuthSecurityClient } from "./web-auth-client.js";
import {
  disableTotpWithPassword,
  enableTotpWithPassword,
  registerPasskey,
  verifyTotpCode,
} from "./web-settings-security.js";

type EnableFn = WebAuthSecurityClient["twoFactor"]["enable"];
type VerifyTotpFn = WebAuthSecurityClient["twoFactor"]["verifyTotp"];
type DisableFn = WebAuthSecurityClient["twoFactor"]["disable"];
type AddPasskeyFn = WebAuthSecurityClient["passkey"]["addPasskey"];

describe("settings security MFA helpers", () => {
  it("enables TOTP through the Better Auth twoFactor client when password is present", async () => {
    const enable = vi.fn<EnableFn>(async () => ({ error: null }));
    await expect(
      enableTotpWithPassword({ twoFactor: { enable } }, "correct-horse"),
    ).resolves.toEqual({ ok: true });
    expect(enable).toHaveBeenCalledWith({ password: "correct-horse", method: "totp" });
  });

  it("verifies and disables TOTP through the Better Auth twoFactor client", async () => {
    const verifyTotp = vi.fn<VerifyTotpFn>(async () => ({ error: null }));
    const disable = vi.fn<DisableFn>(async () => ({ error: null }));
    await expect(verifyTotpCode({ twoFactor: { verifyTotp } }, "123456")).resolves.toEqual({
      ok: true,
    });
    expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" });
    await expect(
      disableTotpWithPassword({ twoFactor: { disable } }, "correct-horse"),
    ).resolves.toEqual({ ok: true });
    expect(disable).toHaveBeenCalledWith({ password: "correct-horse" });
  });

  it("registers a passkey through the Better Auth passkey client", async () => {
    const addPasskey = vi.fn<AddPasskeyFn>(async () => ({ error: null }));
    await expect(registerPasskey({ passkey: { addPasskey } })).resolves.toEqual({ ok: true });
    expect(addPasskey).toHaveBeenCalledWith({ name: "supastack" });
  });

  it("surfaces client and empty-password failures without claiming device success", async () => {
    const enableReject: EnableFn = async () => ({ error: { message: "Invalid password" } });
    const enableOk: EnableFn = async () => ({ error: null });
    const verifyOk: VerifyTotpFn = async () => ({ error: null });
    const addPasskeyReject: AddPasskeyFn = async () => {
      throw new Error("cancelled");
    };

    await expect(
      enableTotpWithPassword({ twoFactor: { enable: enableReject } }, "bad"),
    ).resolves.toEqual({ ok: false, message: "Invalid password" });
    await expect(
      enableTotpWithPassword({ twoFactor: { enable: enableOk } }, "  "),
    ).resolves.toEqual({ ok: false, message: "Password is required to enable TOTP." });
    await expect(verifyTotpCode({ twoFactor: { verifyTotp: verifyOk } }, " ")).resolves.toEqual({
      ok: false,
      message: "Authenticator code is required.",
    });
    await expect(registerPasskey({ passkey: { addPasskey: addPasskeyReject } })).resolves.toEqual({
      ok: false,
      message: "Passkey registration was cancelled or failed.",
    });
  });
});
