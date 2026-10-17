import "tsx/cjs";
import type { ConfigContext, ExpoConfig } from "expo/config";

import { createMobileAuthConfiguration } from "./src/auth/mobile-auth-configuration";

export default function configureExpo({ config }: Pick<ConfigContext, "config">): ExpoConfig {
  const auth = createMobileAuthConfiguration(process.env.EXPO_PUBLIC_APP_SCHEME);
  return {
    ...config,
    scheme: auth.scheme,
    extra: { ...config.extra, productionDeepLinkOrigins: [...auth.origins] },
  };
}
