import { describe, expect, it } from "vitest";

import type { GrowthStore } from "./early-access";
import { inviteWaitlistEntries, joinWaitlist, type WaitlistMailer } from "./waitlist-service";
import type { EarlyAccessCodeRow, ReferralInsert, WaitlistEntryRow } from "./early-access";

const NOW = new Date("2026-09-22T00:00:00Z");

function fakeStore(seed?: { codes?: EarlyAccessCodeRow[]; entries?: WaitlistEntryRow[] }) {
  const codes = [...(seed?.codes ?? [])];
  const entries = [...(seed?.entries ?? [])];
  const referrals: ReferralInsert[] = [];
  const store: GrowthStore = {
    async findEarlyAccessCode(code) {
      return codes.find((c) => c.code === code) ?? null;
    },
    async bindEarlyAccessCodeEmail({ id, email }) {
      const code = codes.find((c) => c.id === id);
      if (!code || (code.email !== null && code.email !== email)) return false;
      code.email = email;
      return true;
    },
    async findWaitlistEntryByEmail(email) {
      return entries.find((e) => e.email === email) ?? null;
    },
    async findWaitlistEntryByReferralCode(code) {
      return entries.find((e) => e.referralCode === code) ?? null;
    },
    async findWaitlistEntryById(id) {
      return entries.find((e) => e.id === id) ?? null;
    },
    async createWaitlistEntry(row) {
      if (entries.some((e) => e.email === row.email)) {
        return "duplicate";
      }
      entries.push({ ...row });
      return "created";
    },
    async countWaitlistPosition(createdAt) {
      return entries.filter((e) => e.createdAt.getTime() <= createdAt.getTime()).length;
    },
    async listWaitlistEntries({ status, limit, order }) {
      let rows = status ? entries.filter((e) => e.status === status) : [...entries];
      rows = rows.sort((a, b) =>
        order === "referral"
          ? b.referralCount - a.referralCount || a.createdAt.getTime() - b.createdAt.getTime()
          : a.createdAt.getTime() - b.createdAt.getTime(),
      );
      return rows.slice(0, limit);
    },
    async createEarlyAccessCode(row) {
      codes.push({ ...row });
    },
    async redeemEarlyAccessCode({ id, userId, now }) {
      const code = codes.find((c) => c.id === id);
      if (!code || code.redeemedAt) return false;
      code.redeemedByUserId = userId;
      code.redeemedAt = now;
      return true;
    },
    async markWaitlistInvited({ id, now }) {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.status !== "waiting") return false;
      entry.status = "invited";
      entry.invitedAt = now;
      return true;
    },
    async markWaitlistJoined({ id }) {
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.status === "joined") return false;
      entry.status = "joined";
      return true;
    },
    async deleteWaitlistEntry(id) {
      const index = entries.findIndex((e) => e.id === id);
      if (index === -1) return false;
      entries.splice(index, 1);
      return true;
    },
    async recordReferral(row) {
      const dup = referrals.some(
        (r) =>
          (row.referredUserId && r.referredUserId === row.referredUserId && r.kind === row.kind) ||
          (row.referredEmail && r.referredEmail === row.referredEmail && r.kind === row.kind),
      );
      if (dup) return "duplicate";
      referrals.push({ ...row });
      const referrer = entries.find((e) => e.id === row.referrerEntryId);
      if (referrer) referrer.referralCount += 1;
      return "created";
    },
  };
  return { codes, entries, referrals, store };
}

const ids = (() => {
  let n = 0;
  return () => `we_${++n}`;
})();

describe("joinWaitlist", () => {
  it("creates an entry with a referral code and reports queue position", async () => {
    const { store, entries } = fakeStore({
      entries: [
        {
          id: "e0",
          email: "ahead@x.test",
          status: "waiting",
          referralCode: "r0",
          referralCount: 0,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: new Date("2026-09-20T00:00:00Z"),
        } as WaitlistEntryRow,
      ],
    });
    const result = await joinWaitlist(store, {
      email: "new@x.test",
      referral: null,
      now: NOW,
      createId: ids,
      referralCode: "shareme",
    });
    expect(result).toMatchObject({ ok: true, outcome: "created", position: 2 });
    expect(entries.at(-1)).toMatchObject({
      email: "new@x.test",
      status: "waiting",
      referralCode: "shareme",
    });
  });

  it("attributes ?ref= to the owning entry and records a waitlist referral", async () => {
    const { store, referrals, entries } = fakeStore({
      entries: [
        {
          id: "e1",
          email: "referrer@x.test",
          status: "waiting",
          referralCode: "ref9",
          referralCount: 0,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: new Date("2026-09-20T00:00:00Z"),
        } as WaitlistEntryRow,
      ],
    });
    await joinWaitlist(store, {
      email: "new@x.test",
      referral: "ref9",
      now: NOW,
      createId: ids,
      referralCode: "mine",
    });
    expect(referrals[0]).toMatchObject({
      kind: "waitlist",
      code: "ref9",
      referrerEntryId: "e1",
      referredEmail: "new@x.test",
    });
    expect(entries[0]!.referralCount).toBe(1);
    expect(entries.at(-1)!.referredByEntryId).toBe("e1");
  });

  it("skips referral credit when the code belongs to the same email", async () => {
    const { store, referrals, entries } = fakeStore({
      entries: [
        {
          id: "e1",
          email: "new@x.test",
          status: "waiting",
          referralCode: "mine",
          referralCount: 0,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: new Date("2026-09-20T00:00:00Z"),
        } as WaitlistEntryRow,
      ],
    });
    const result = await joinWaitlist(store, {
      email: "new@x.test",
      referral: "mine",
      now: NOW,
      createId: ids,
      referralCode: "new",
    });
    expect(result.outcome).toBe("duplicate");
    expect(referrals).toEqual([]);
    expect(entries[0]!.referralCount).toBe(0);
  });

  it("returns a generic duplicate result without reading rank or referral code", async () => {
    const { store } = fakeStore({
      entries: [
        {
          id: "e1",
          email: "dup@x.test",
          status: "waiting",
          referralCode: "orig",
          referralCount: 3,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: new Date("2026-09-20T00:00:00Z"),
        } as WaitlistEntryRow,
      ],
    });
    store.findWaitlistEntryByEmail = async () => {
      throw new Error("duplicate submission must not read the existing entry");
    };
    store.countWaitlistPosition = async () => {
      throw new Error("duplicate submission must not calculate rank");
    };
    const result = await joinWaitlist(store, {
      email: "dup@x.test",
      referral: null,
      now: NOW,
      createId: ids,
      referralCode: "other",
    });
    expect(result).toEqual({ ok: true, outcome: "duplicate" });
  });
});

describe("inviteWaitlistEntries", () => {
  const mailer = () => {
    const sent: Array<{ to: string; subject: string; text: string }> = [];
    const send: WaitlistMailer["send"] = async (message) => {
      sent.push(message);
    };
    return { send, sent };
  };

  it("issues email-bound codes, marks entries invited, and sends mail", async () => {
    const { send, sent } = mailer();
    const { store, codes, entries } = fakeStore({
      entries: [
        {
          id: "e1",
          email: "a@x.test",
          status: "waiting",
          referralCode: "r1",
          referralCount: 2,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: new Date("2026-09-20T00:00:00Z"),
        } as WaitlistEntryRow,
        {
          id: "e2",
          email: "b@x.test",
          status: "waiting",
          referralCode: "r2",
          referralCount: 0,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: new Date("2026-09-21T00:00:00Z"),
        } as WaitlistEntryRow,
      ],
    });
    const result = await inviteWaitlistEntries(store, {
      count: 1,
      adminUserId: "admin_1",
      appUrl: "https://app.test",
      locale: "en",
      now: NOW,
      send,
      createCode: (() => {
        let n = 0;
        return () => `code_${++n}`;
      })(),
      createId: (() => {
        let n = 0;
        return () => `eac_${++n}`;
      })(),
    });
    expect(result.invited).toBe(1);
    // referral count wins the ordering — a@x.test (2 refs) invited before b
    expect(codes[0]).toMatchObject({
      code: "code_1",
      email: "a@x.test",
      waitlistEntryId: "e1",
      createdByUserId: "admin_1",
    });
    expect(entries[0]!.status).toBe("invited");
    expect(sent[0]).toMatchObject({ to: "a@x.test" });
    expect(sent[0]!.text).toContain("invite=code_1");
  });

  it("reports mail failures without losing the code/invite state", async () => {
    const { codes, entries, store } = fakeStore({
      entries: [
        {
          id: "e1",
          email: "a@x.test",
          status: "waiting",
          referralCode: "r1",
          referralCount: 0,
          referredByEntryId: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: NOW,
        } as WaitlistEntryRow,
      ],
    });
    const result = await inviteWaitlistEntries(store, {
      count: 5,
      adminUserId: "admin_1",
      appUrl: "https://app.test",
      locale: "en",
      now: NOW,
      send: async () => {
        throw new Error("provider down");
      },
      createCode: () => "c1",
      createId: () => "eac_1",
    });
    expect(result.invited).toBe(0);
    expect(result.failed).toEqual(["a@x.test"]);
    expect(codes).toHaveLength(1);
    expect(entries[0]!.status).toBe("invited");
  });
});
