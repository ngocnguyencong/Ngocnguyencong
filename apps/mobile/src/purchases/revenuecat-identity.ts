export interface RevenueCatIdentitySdk {
  configure(input: { apiKey: string; appUserId: string }): void | Promise<void>;
  logIn(appUserId: string): Promise<unknown>;
}

/** Keeps each workspace identity switch and its store operation in one queue. */
export function createRevenueCatIdentityQueue(sdk: RevenueCatIdentitySdk, apiKey: string) {
  let currentAppUserId: string | null = null;
  let configured = false;
  let pending: Promise<void> = Promise.resolve();

  function run<T>(appUserId: string, operation: () => Promise<T>): Promise<T> {
    const result = pending.then(async () => {
      if (!appUserId.trim()) throw new Error("A server purchase identity is required.");
      if (!configured) {
        await sdk.configure({ apiKey, appUserId });
        configured = true;
        currentAppUserId = appUserId;
      } else if (currentAppUserId !== appUserId) {
        await sdk.logIn(appUserId);
        currentAppUserId = appUserId;
      }
      return operation();
    });
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return { run };
}
