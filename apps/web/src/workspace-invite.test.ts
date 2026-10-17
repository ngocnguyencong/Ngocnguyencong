import { describe, expect, it } from "vitest";

import {
  buildWorkspaceInviteEmail,
  evaluateInviteAcceptance,
  evaluateWorkspaceSeatLimit,
} from "./workspace-invite.js";

describe("workspace invite acceptance", () => {
  const base = {
    email: "teammate@example.test",
    expiresAt: new Date("2026-09-17T00:00:00.000Z"),
    role: "member",
    status: "pending",
    workspaceId: "ws_org",
  };

  it("accepts a pending unexpired invite for the matching session email", () => {
    expect(
      evaluateInviteAcceptance({
        invitation: base,
        now: new Date("2026-09-10T00:00:00.000Z"),
        sessionEmail: "Teammate@Example.TEST",
      }),
    ).toEqual({ ok: true, role: "member", workspaceId: "ws_org" });
  });

  it("preserves guest role when accepting an invitation", () => {
    expect(
      evaluateInviteAcceptance({
        invitation: { ...base, role: "guest" },
        now: new Date("2026-09-10T00:00:00.000Z"),
        sessionEmail: "teammate@example.test",
      }),
    ).toEqual({ ok: true, role: "guest", workspaceId: "ws_org" });
  });

  it("rejects missing, spent, expired, and mismatched invites", () => {
    expect(
      evaluateInviteAcceptance({
        invitation: null,
        now: new Date("2026-09-10T00:00:00.000Z"),
        sessionEmail: "teammate@example.test",
      }),
    ).toEqual({ ok: false, reason: "missing" });
    expect(
      evaluateInviteAcceptance({
        invitation: { ...base, status: "accepted" },
        now: new Date("2026-09-10T00:00:00.000Z"),
        sessionEmail: "teammate@example.test",
      }),
    ).toEqual({ ok: false, reason: "not-pending" });
    expect(
      evaluateInviteAcceptance({
        invitation: base,
        now: new Date("2026-09-18T00:00:00.000Z"),
        sessionEmail: "teammate@example.test",
      }),
    ).toEqual({ ok: false, reason: "expired" });
    expect(
      evaluateInviteAcceptance({
        invitation: base,
        now: new Date("2026-09-10T00:00:00.000Z"),
        sessionEmail: "other@example.test",
      }),
    ).toEqual({ ok: false, reason: "email-mismatch" });
  });

  it("builds an accept URL email without inventing subscriber counts", () => {
    const message = buildWorkspaceInviteEmail({
      acceptUrl: "https://app.example.test/invite/tok",
      inviterEmail: "owner@example.test",
      workspaceName: "Acme",
    });
    expect(message.subject).toMatch(/invited/i);
    expect(message.text).toContain("https://app.example.test/invite/tok");
    expect(message.text).toContain("Acme");
    expect(message.lang).toBe("en");
    expect(message.footer).toMatch(/transactional/i);
  });

  it("localizes invite mail copy when a supported locale is supplied", () => {
    const message = buildWorkspaceInviteEmail({
      acceptUrl: "https://app.example.test/invite/tok",
      inviterEmail: "owner@example.test",
      locale: "de",
      workspaceName: "Acme",
    });
    expect(message.subject).toContain("Einladung");
    expect(message.text).toContain("Acme");
    expect(message.lang).toBe("de");
    expect(message.footer).toMatch(/Transaktionsnachricht/);
  });
});

describe("workspace seat limit enforcement", () => {
  it("allows invitations when under seat limit", () => {
    const decision = evaluateWorkspaceSeatLimit({
      memberCount: 2,
      pendingInviteCount: 1,
      seatLimit: 5,
    });
    expect(decision).toEqual({
      allowed: true,
      currentSeats: 3,
      remainingSeats: 2,
    });
  });

  it("blocks invitations when total members and pending invites reach limit", () => {
    const decision = evaluateWorkspaceSeatLimit({
      memberCount: 4,
      pendingInviteCount: 1,
      seatLimit: 5,
    });
    expect(decision).toEqual({
      allowed: false,
      currentSeats: 5,
      remainingSeats: 0,
      reason: "seat-limit-exceeded",
    });
  });

  it("blocks free tier organizations from inviting when sole owner already fills 1-seat limit", () => {
    const decision = evaluateWorkspaceSeatLimit({
      memberCount: 1,
      pendingInviteCount: 0,
      seatLimit: 1,
    });
    expect(decision).toEqual({
      allowed: false,
      currentSeats: 1,
      remainingSeats: 0,
      reason: "seat-limit-exceeded",
    });
  });

  it("allows unlimited invitations for plans without seat limit (null)", () => {
    const decision = evaluateWorkspaceSeatLimit({
      memberCount: 50,
      pendingInviteCount: 10,
      seatLimit: null,
    });
    expect(decision).toEqual({
      allowed: true,
      currentSeats: 60,
      remainingSeats: null,
    });
  });
});
