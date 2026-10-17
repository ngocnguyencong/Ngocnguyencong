declare module "@better-auth/passkey/client" {
  import type { BetterAuthClientPlugin } from "better-auth/client";

  export function passkeyClient(): BetterAuthClientPlugin;
}
