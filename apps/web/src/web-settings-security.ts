import type { WebAuthSecurityClient } from "./web-auth-client";

export async function enableTotpWithPassword(
  client: { twoFactor: Pick<WebAuthSecurityClient["twoFactor"], "enable"> },
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (password.trim().length === 0) {
    return { ok: false, message: "Password is required to enable TOTP." };
  }
  try {
    const result = await client.twoFactor.enable({ password, method: "totp" });
    if (result.error) {
      return { ok: false, message: result.error.message ?? "Two-factor could not be enabled." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Two-factor could not be enabled." };
  }
}

export async function verifyTotpCode(
  client: { twoFactor: Pick<WebAuthSecurityClient["twoFactor"], "verifyTotp"> },
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (code.trim().length === 0) {
    return { ok: false, message: "Authenticator code is required." };
  }
  try {
    const result = await client.twoFactor.verifyTotp({ code });
    if (result.error) {
      return { ok: false, message: result.error.message ?? "Authenticator code was rejected." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Authenticator code was rejected." };
  }
}

export async function disableTotpWithPassword(
  client: { twoFactor: Pick<WebAuthSecurityClient["twoFactor"], "disable"> },
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (password.trim().length === 0) {
    return { ok: false, message: "Password is required to disable TOTP." };
  }
  try {
    const result = await client.twoFactor.disable({ password });
    if (result.error) {
      return { ok: false, message: result.error.message ?? "Two-factor could not be disabled." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Two-factor could not be disabled." };
  }
}

export async function registerPasskey(
  client: Pick<WebAuthSecurityClient, "passkey">,
  name = "supastack",
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const result = await client.passkey.addPasskey({ name });
    if (result?.error) {
      return { ok: false, message: result.error.message ?? "Passkey could not be registered." };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Passkey registration was cancelled or failed." };
  }
}
