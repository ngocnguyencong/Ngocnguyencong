import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

import { mobileAuthConfiguration } from "./mobile-auth-configuration";

export const mobileAuthApiUrl = process.env.EXPO_PUBLIC_API_URL as string | undefined;

export function createMobileAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      emailOTPClient(),
      expoClient({
        cookiePrefix: "better-auth",
        scheme: mobileAuthConfiguration.scheme,
        storage: SecureStore,
        storagePrefix: "supastack.auth",
      }),
    ],
  });
}
