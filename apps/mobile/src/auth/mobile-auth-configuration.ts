export function createMobileAuthConfiguration(scheme: string = "supastack") {
  if (
    !/^[a-z][a-z0-9+.-]*$/.test(scheme) ||
    ["http", "https", "file", "javascript", "data", "exp", "exps"].includes(scheme)
  ) {
    throw new Error("EXPO_PUBLIC_APP_SCHEME must be an explicit native URI scheme.");
  }
  return Object.freeze({
    scheme,
    callbackURL: `${scheme}://auth/callback`,
    origins: Object.freeze([`${scheme}://auth`, "https://app.supastack.example.com"]),
  });
}

// Keep direct property access: Expo inlines only statically referenced public env values.
export const mobileAuthConfiguration = createMobileAuthConfiguration(
  process.env.EXPO_PUBLIC_APP_SCHEME as string | undefined,
);
