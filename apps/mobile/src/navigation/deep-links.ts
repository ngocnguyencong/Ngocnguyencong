import { mobileAuthConfiguration } from "../auth/mobile-auth-configuration";

export const productionDeepLinkOrigins = mobileAuthConfiguration.origins;
export const productionAuthCallbackURL = mobileAuthConfiguration.callbackURL;

function callbackOrigin(url: URL): string {
  if (url.protocol === `${mobileAuthConfiguration.scheme}:`) {
    return `${url.protocol}//${url.host}`;
  }

  return url.origin;
}

export function isAllowedProductionDeepLink(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.username || url.password) return false;
    return productionDeepLinkOrigins.includes(callbackOrigin(url));
  } catch {
    return false;
  }
}
