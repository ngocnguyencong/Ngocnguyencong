import type { MobileApiClient } from "../api/client";

export interface MobilePushToken {
  id: string;
  lastSeenAt: string;
  platform: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPushToken(value: unknown): value is MobilePushToken {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.lastSeenAt === "string" &&
    typeof value.platform === "string"
  );
}

/** `/api/mobile/push-tokens` — register, list, and unregister device push tokens. */
export function createMobilePushTokenActions(api: MobileApiClient) {
  return {
    async list(): Promise<MobilePushToken[]> {
      const payload = await api.request<unknown>("/api/mobile/push-tokens");
      if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.tokens)) {
        throw new Error("The push token list was invalid.");
      }
      return payload.data.tokens.filter(isPushToken);
    },

    async register(input: { platform: string; token: string }): Promise<MobilePushToken> {
      const payload = await api.request<unknown>("/api/mobile/push-tokens", {
        body: { platform: input.platform, token: input.token },
        method: "POST",
      });
      if (!isRecord(payload) || !isRecord(payload.data) || !isPushToken(payload.data.token)) {
        throw new Error("The push token registration was invalid.");
      }
      return payload.data.token;
    },

    async unregister(token: string): Promise<void> {
      await api.request("/api/mobile/push-tokens", {
        body: { token },
        method: "DELETE",
      });
    },
  };
}
