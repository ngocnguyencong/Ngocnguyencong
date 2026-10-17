import "server-only";

import { parseServerConfig, type ServerConfig } from "@supastack/config";

/**
 * Bot-protection boundary for public, unauthenticated endpoints. The verifier
 * behind `getCaptchaVerifier()` is env-selected: `CAPTCHA_PROVIDER=off`
 * (default) always passes so local dev stays credential-free; `turnstile`
 * posts the token to Cloudflare siteverify and fails closed on any error.
 */

export interface CaptchaVerifier {
  /** True = human (or captcha disabled); false = reject the submission. */
  verify(token: string | undefined, remoteIp?: string): Promise<boolean>;
}

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 10_000;

type TurnstileSiteverifyResponse = { success?: boolean };

export function createTurnstileVerifier(options: {
  secretKey: string;
  fetchImpl?: typeof fetch;
  verifyUrl?: string;
}): CaptchaVerifier {
  const fetchImpl = options.fetchImpl ?? fetch;
  const verifyUrl = options.verifyUrl ?? TURNSTILE_VERIFY_URL;

  return {
    async verify(token, remoteIp) {
      if (!token) {
        return false;
      }
      const body = new URLSearchParams({
        secret: options.secretKey,
        response: token,
      });
      if (remoteIp) {
        body.set("remoteip", remoteIp);
      }
      try {
        const response = await fetchImpl(verifyUrl, {
          method: "POST",
          body,
          signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
        });
        if (!response.ok) {
          return false;
        }
        const data = (await response.json()) as TurnstileSiteverifyResponse;
        return data.success === true;
      } catch {
        // Fail closed: an unverifiable token is not proof of humanity.
        return false;
      }
    },
  };
}

export function createCaptchaVerifier(
  captcha: ServerConfig["providers"]["captcha"],
  deps: { fetchImpl?: typeof fetch } = {},
): CaptchaVerifier {
  if (captcha.kind === "turnstile") {
    return createTurnstileVerifier({ secretKey: captcha.secretKey, ...deps });
  }
  return { verify: async () => true };
}

let sharedVerifier: CaptchaVerifier | undefined;

/** Process-wide verifier composed once from env. */
export function getCaptchaVerifier(): CaptchaVerifier {
  sharedVerifier ??= createCaptchaVerifier(parseServerConfig().providers.captcha);
  return sharedVerifier;
}
