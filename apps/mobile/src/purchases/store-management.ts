const STORE_SUBSCRIPTIONS_URLS: Readonly<Record<string, string>> = Object.freeze({
  android: "https://play.google.com/store/account/subscriptions",
  ios: "https://apps.apple.com/account/subscriptions",
});

/** Returns a fixed official store subscription page for supported native platforms. */
export function storeSubscriptionsUrl(platform: string): string | null {
  return STORE_SUBSCRIPTIONS_URLS[platform] ?? null;
}
