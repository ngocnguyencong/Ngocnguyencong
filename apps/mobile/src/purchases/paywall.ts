import { createRevenueCatIdentityQueue } from "./revenuecat-identity";

export interface PurchasesPackage {
  identifier: string;
  priceString: string;
  productIdentifier: string;
  title: string;
}

/** The app only receives store operations, never client-side access decisions. */
export interface PurchasesProvider {
  getOfferings(appUserId?: string): Promise<PurchasesPackage[]>;
  purchasePackage(identifier: string, appUserId?: string): Promise<void>;
  restorePurchases(appUserId?: string): Promise<void>;
}

export type PaywallState =
  | Readonly<{ entitlement: string | null; kind: "success" }>
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "purchasing"; packageId: string | null }>
  | Readonly<{ kind: "restoring" }>
  | Readonly<{ kind: "failure"; message: string }>;

export type PaywallEvent =
  | Readonly<{ kind: "purchase_started"; packageId?: string }>
  | Readonly<{ kind: "purchase_succeeded"; entitlement: string | null }>
  | Readonly<{ kind: "purchase_failed"; message: string }>
  | Readonly<{ kind: "purchase_cancelled" }>
  | Readonly<{ kind: "restore_started" }>
  | Readonly<{ kind: "restore_succeeded"; entitlement: string | null }>
  | Readonly<{ kind: "restore_failed"; message: string }>
  | Readonly<{ kind: "reset" }>;

export function reducePaywallEvent(state: PaywallState, event: PaywallEvent): PaywallState {
  switch (event.kind) {
    case "purchase_started":
      return state.kind === "success"
        ? state
        : { kind: "purchasing", packageId: event.packageId ?? null };
    case "purchase_succeeded":
      return { entitlement: event.entitlement, kind: "success" };
    case "purchase_failed":
      return { kind: "failure", message: event.message };
    case "purchase_cancelled":
      return { kind: "idle" };
    case "restore_started":
      return { kind: "restoring" };
    case "restore_succeeded":
      return { entitlement: event.entitlement, kind: "success" };
    case "restore_failed":
      return { kind: "failure", message: event.message };
    case "reset":
      return { kind: "idle" };
  }
}

export interface PaywallPresentation {
  ctaDisabled: boolean;
  ctaLabel: string;
  message: string | null;
  showRestore: boolean;
  title: string;
}

export function toPaywallPresentation(state: PaywallState): PaywallPresentation {
  switch (state.kind) {
    case "idle":
      return {
        ctaDisabled: false,
        ctaLabel: "Upgrade",
        message: null,
        showRestore: true,
        title: "Upgrade to Pro",
      };
    case "purchasing":
      return {
        ctaDisabled: true,
        ctaLabel: "Processing…",
        message: null,
        showRestore: false,
        title: "Upgrade to Pro",
      };
    case "restoring":
      return {
        ctaDisabled: true,
        ctaLabel: "Restoring…",
        message: null,
        showRestore: false,
        title: "Restore purchases",
      };
    case "success":
      return {
        ctaDisabled: true,
        ctaLabel: "Done",
        message: null,
        showRestore: false,
        title:
          state.entitlement === null
            ? "Nothing to restore"
            : `Welcome to ${state.entitlement === "pro" ? "Pro" : state.entitlement}`,
      };
    case "failure":
      return {
        ctaDisabled: false,
        ctaLabel: "Try again",
        message: state.message,
        showRestore: true,
        title: "Purchase failed",
      };
  }
}

const FAKE_PACKAGES: PurchasesPackage[] = [
  {
    identifier: "supastack_pro_monthly",
    priceString: "$9.99",
    productIdentifier: "pro_monthly",
    title: "Pro Monthly",
  },
  {
    identifier: "supastack_pro_yearly",
    priceString: "$99.00",
    productIdentifier: "pro_yearly",
    title: "Pro Yearly",
  },
];

/** Deterministic UI-preview provider. Its simulated purchases grant no access. */
export function createFakePurchasesProvider(): PurchasesProvider {
  return {
    async getOfferings() {
      return FAKE_PACKAGES;
    },
    async purchasePackage(identifier: string) {
      if (!FAKE_PACKAGES.some((entry) => entry.identifier === identifier)) {
        throw new Error(`Unknown package: ${identifier}`);
      }
    },
    async restorePurchases() {},
  };
}

/** Error thrown when store purchases are selected without native configuration. */
export class PurchasesNotConfiguredError extends Error {
  constructor() {
    super("RevenueCat is unavailable. Check the app provider, public API key, and native build.");
    this.name = "PurchasesNotConfiguredError";
  }
}

export class PurchaseCancelledError extends Error {
  constructor() {
    super("The purchase was cancelled.");
    this.name = "PurchaseCancelledError";
  }
}

interface RevenueCatLikeSdk {
  configure(input: { apiKey: string; appUserId: string }): void | Promise<void>;
  getOfferings(): Promise<unknown>;
  logIn(appUserId: string): Promise<unknown>;
  purchasePackage(identifier: string): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function normalizeOfferings(value: unknown): PurchasesPackage[] {
  const current = record(record(value)?.current);
  const packages = Array.isArray(current?.availablePackages) ? current.availablePackages : [];
  return packages.flatMap((value) => {
    const item = record(value);
    const product = record(item?.product);
    if (!item || typeof item.identifier !== "string") return [];
    return [
      {
        identifier: item.identifier,
        priceString: typeof product?.priceString === "string" ? product.priceString : "",
        productIdentifier: typeof product?.identifier === "string" ? product.identifier : "",
        title: typeof product?.title === "string" ? product.title : item.identifier,
      },
    ];
  });
}

function requireIdentity(appUserId: string | undefined): string {
  if (!appUserId?.trim()) {
    throw new Error("A server-provided workspace purchase identity is required.");
  }
  return appUserId;
}

function isPurchaseCancelled(error: unknown): boolean {
  const candidate = record(error);
  return candidate?.userCancelled === true || candidate?.code === "PURCHASE_CANCELLED_ERROR";
}

/** Adapts the native RevenueCat SDK and serializes identity with every operation. */
export function createRevenueCatProvider(
  sdk: RevenueCatLikeSdk | null,
  apiKey: string | null,
): PurchasesProvider {
  if (sdk === null || !apiKey?.trim()) {
    const fail = async (): Promise<never> => {
      throw new PurchasesNotConfiguredError();
    };
    return { getOfferings: fail, purchasePackage: fail, restorePurchases: fail };
  }

  const identities = createRevenueCatIdentityQueue(sdk, apiKey.trim());
  return {
    async getOfferings(appUserId) {
      return identities.run(requireIdentity(appUserId), async () =>
        normalizeOfferings(await sdk.getOfferings()),
      );
    },
    async purchasePackage(identifier, appUserId) {
      try {
        await identities.run(requireIdentity(appUserId), async () => {
          await sdk.purchasePackage(identifier);
        });
      } catch (error) {
        if (isPurchaseCancelled(error)) throw new PurchaseCancelledError();
        throw error;
      }
    },
    async restorePurchases(appUserId) {
      await identities.run(requireIdentity(appUserId), async () => {
        await sdk.restorePurchases();
      });
    },
  };
}
