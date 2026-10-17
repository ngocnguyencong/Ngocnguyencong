import { describe, expect, it } from "vitest";

import {
  handleEarlyAccessUserCreated,
  validateEarlyAccessCode,
  type GrowthStore,
} from "./early-access";

const NOW = new Date("2026-09-22T00:00:00Z");

type StoredCode = {
  id: string;
  code: string;
  email: string | null;
  waitlistEntryId: string | null;
  createdByUserId: string | null;
  redeemedByUserId: string | null;
  redeemedAt: Date | null;
  expiresAt: Date | null;
};
type StoredEntry = {
  id: string;
  email: string;
  status: string;
  referralCode: string;
  referralCount: number;
  referredByEntryId: string | null;
  invitedAt: Date | null;
  joinedAt: Date | null;
  createdAt: Date;
};

const entry = (partial: Partial<StoredEntry> & Pick<StoredEntry, "id" | "email">): StoredEntry => ({
  status: "waiting",
  referralCode: `r_${partial.id}`,
  referralCount: 0,
  referredByEntryId: null,
  invitedAt: null,
  joinedAt: null,
  createdAt: NOW,
  ...partial,
});

function fakeStore(seed?: { codes?: StoredCode[]; entries?: StoredEntry[] }) {
  const codes = [...(seed?.codes ?? [])];
  const entries = [...(seed?.entries ?? [])];
  const referrals: Array<Record<string, unknown>> = [];
  const store: GrowthStore = {
    async findEarlyAccessCode(code) {
      return codes.find((c) => c.code === code) ?? null;
    },
    async bindEarlyAccessCodeEmail({ id, email, now }) {
      const code = codes.find((c) => c.id === id);
      if (
        !code ||
        code.redeemedAt ||
        (code.expiresAt !== null && code.expiresAt.getTime() <= now.getTime()) ||
        (code.email !== null && code.email !== email)
      ) {
        return false;
      }
      code.email = email;
      return true;
    },
    async findWaitlistEntryByEmail(email) {
      return entries.find((e) => e.email === email) ?? null;
    },
    async findWaitlistEntryByReferralCode(code) {
      return entries.find((e) => e.referralCode === code) ?? null;
    },
    async redeemEarlyAccessCode({ id, userId, now }) {
      const code = codes.find((c) => c.id === id);
      if (!code || code.redeemedAt) {
        return false;
      }
      code.redeemedByUserId = userId;
      code.redeemedAt = now;
      return true;
    },
    async markWaitlistJoined({ id, now }) {
      const found = entries.find((e) => e.id === id);
      if (!found || found.status === "joined") {
        return false;
      }
      found.status = "joined";
      void now;
      return true;
    },
    async findWaitlistEntryById(id) {
      return entries.find((e) => e.id === id) ?? null;
    },
    async createWaitlistEntry() {
      return "created" as const;
    },
    async countWaitlistPosition() {
      return 0;
    },
    async listWaitlistEntries() {
      return [];
    },
    async createEarlyAccessCode() {},
    async markWaitlistInvited() {
      return false;
    },
    async deleteWaitlistEntry() {
      return false;
    },
    async recordReferral(row) {
      const dup = referrals.some(
        (r) =>
          (row.referredUserId && r.referredUserId === row.referredUserId && r.kind === row.kind) ||
          (row.referredEmail && r.referredEmail === row.referredEmail && r.kind === row.kind),
      );
      if (dup) {
        return "duplicate";
      }
      referrals.push({ ...row });
      return "created";
    },
  };
  return { codes, entries, referrals, store };
}

describe("validateEarlyAccessCode", () => {
  it("maps store rows to statuses", async () => {
    const { store } = fakeStore({
      codes: [
        {
          id: "c1",
          code: "good",
          email: null,
          waitlistEntryId: null,
          createdByUserId: null,
          redeemedByUserId: null,
          redeemedAt: null,
          expiresAt: null,
        },
        {
          id: "c2",
          code: "bound",
          email: "pat@x.test",
          waitlistEntryId: null,
          createdByUserId: null,
          redeemedByUserId: null,
          redeemedAt: null,
          expiresAt: null,
        },
        {
          id: "c3",
          code: "gone",
          email: null,
          waitlistEntryId: null,
          createdByUserId: null,
          redeemedByUserId: "u",
          redeemedAt: NOW,
          expiresAt: null,
        },
      ],
    });
    expect(
      await validateEarlyAccessCode(store, { code: "good", email: "a@x.test", now: NOW }),
    ).toBe("valid");
    expect(
      await validateEarlyAccessCode(store, { code: "bound", email: "a@x.test", now: NOW }),
    ).toBe("email-mismatch");
    expect(
      await validateEarlyAccessCode(store, { code: "bound", email: "pat@x.test", now: NOW }),
    ).toBe("valid");
    expect(
      await validateEarlyAccessCode(store, { code: "gone", email: "a@x.test", now: NOW }),
    ).toBe("redeemed");
    expect(
      await validateEarlyAccessCode(store, { code: "none", email: "a@x.test", now: NOW }),
    ).toBe("unknown");
  });

  it("binds a one-use unbound invite to exactly one verified signup email", async () => {
    const { codes, store } = fakeStore({
      codes: [
        {
          id: "c1",
          code: "unbound",
          email: null,
          waitlistEntryId: null,
          createdByUserId: null,
          redeemedByUserId: null,
          redeemedAt: null,
          expiresAt: null,
        },
      ],
    });

    const attempts = await Promise.all(
      ["alice@x.test", "bob@x.test"].map((email) =>
        validateEarlyAccessCode(store, { code: "unbound", email, now: NOW }),
      ),
    );

    expect(attempts.filter((status) => status === "valid")).toHaveLength(1);
    expect(attempts.filter((status) => status === "email-mismatch")).toHaveLength(1);
    expect(["alice@x.test", "bob@x.test"]).toContain(codes[0]!.email);
    expect(codes[0]!.redeemedAt).toBeNull();
  });

  it("keeps a failed signup retryable for the same verified email", async () => {
    const { codes, store } = fakeStore({
      codes: [
        {
          id: "c1",
          code: "unbound",
          email: null,
          waitlistEntryId: null,
          createdByUserId: null,
          redeemedByUserId: null,
          redeemedAt: null,
          expiresAt: null,
        },
      ],
    });

    expect(
      await validateEarlyAccessCode(store, { code: "unbound", email: " Alice@x.test ", now: NOW }),
    ).toBe("valid");
    // Simulate user creation failing before the post-create redemption hook.
    expect(codes[0]!.redeemedAt).toBeNull();
    expect(codes[0]!.email).toBe("alice@x.test");
    expect(
      await validateEarlyAccessCode(store, { code: "unbound", email: "alice@x.test", now: NOW }),
    ).toBe("valid");
    expect(
      await validateEarlyAccessCode(store, { code: "unbound", email: "bob@x.test", now: NOW }),
    ).toBe("email-mismatch");
  });
});

describe("handleEarlyAccessUserCreated", () => {
  const user = { id: "user_1", email: "new@x.test" };

  it("redeems a valid invite code and joins its bound waitlist entry", async () => {
    const { codes, entries, store } = fakeStore({
      codes: [
        {
          id: "c1",
          code: "good",
          email: "new@x.test",
          waitlistEntryId: "e1",
          createdByUserId: null,
          redeemedByUserId: null,
          redeemedAt: null,
          expiresAt: null,
        },
      ],
      entries: [entry({ id: "e1", email: "new@x.test", status: "invited", referralCode: "r1" })],
    });
    await handleEarlyAccessUserCreated(store, {
      user,
      invite: "good",
      referral: null,
      now: NOW,
    });
    expect(codes[0]!.redeemedByUserId).toBe("user_1");
    expect(codes[0]!.redeemedAt).toEqual(NOW);
    expect(entries[0]!.status).toBe("joined");
  });

  it("joins a waitlist entry matching the signup email even without a code", async () => {
    const { entries, store } = fakeStore({
      entries: [entry({ id: "e1", email: "new@x.test", status: "waiting", referralCode: "r1" })],
    });
    await handleEarlyAccessUserCreated(store, { user, invite: null, referral: null, now: NOW });
    expect(entries[0]!.status).toBe("joined");
  });

  it("does not redeem an invalid code but still joins the waitlist entry", async () => {
    const { codes, entries, store } = fakeStore({
      codes: [
        {
          id: "c1",
          code: "bound",
          email: "other@x.test",
          waitlistEntryId: null,
          createdByUserId: null,
          redeemedByUserId: null,
          redeemedAt: null,
          expiresAt: null,
        },
      ],
      entries: [entry({ id: "e1", email: "new@x.test", status: "waiting", referralCode: "r1" })],
    });
    await handleEarlyAccessUserCreated(store, {
      user,
      invite: "bound",
      referral: null,
      now: NOW,
    });
    expect(codes[0]!.redeemedAt).toBeNull();
    expect(entries[0]!.status).toBe("joined");
  });

  it("records a signup referral for a known referral code", async () => {
    const { referrals, store } = fakeStore({
      entries: [
        entry({ id: "e1", email: "referrer@x.test", status: "waiting", referralCode: "ref9" }),
      ],
    });
    await handleEarlyAccessUserCreated(store, { user, invite: null, referral: "ref9", now: NOW });
    expect(referrals).toEqual([
      expect.objectContaining({
        kind: "signup",
        code: "ref9",
        referrerEntryId: "e1",
        referredUserId: "user_1",
        referredEmail: "new@x.test",
      }),
    ]);
  });

  it("skips self-referrals and unknown codes", async () => {
    const { referrals, store } = fakeStore({
      entries: [entry({ id: "e1", email: "new@x.test", status: "waiting", referralCode: "mine" })],
    });
    await handleEarlyAccessUserCreated(store, { user, invite: null, referral: "mine", now: NOW });
    await handleEarlyAccessUserCreated(store, { user, invite: null, referral: "nope", now: NOW });
    expect(referrals).toEqual([]);
  });
});
