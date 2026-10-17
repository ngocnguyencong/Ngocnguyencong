import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./auth-runtime", () => ({ database: {} }));

const dependencies = vi.hoisted(() => ({
  captureException: vi.fn(),
  send: vi.fn(),
  track: vi.fn(),
}));
vi.mock("./observability-runtime", () => ({
  serverObservability: {
    captureException: dependencies.captureException,
    track: dependencies.track,
  },
}));
// The composition module pulls the whole provider SDK graph — the digest
// tests only need the transactional sender slot it exposes.
vi.mock("./server-provider-composition", () => ({
  createServerTransactionalEmailSender: vi.fn(() => ({ send: dependencies.send })),
}));

import type { TransactionalEmail } from "@supastack/email";

import {
  buildDigestMessage,
  createEmailDigestHandler,
  EMAIL_DIGEST_JOB_TYPE,
  emailDigestHandler,
  parseDigestInput,
  type DigestEntry,
} from "./digest-job";
import type { JobHandlerContext } from "./job-handlers";

const CTX: JobHandlerContext = {
  now: new Date("2026-03-04T09:00:00.000Z"),
  scheduleId: "sch_1",
  workspaceId: "ws_1",
};
const DAY_MS = 86_400_000;

function entry(overrides: Partial<DigestEntry> = {}): DigestEntry {
  return {
    excerpt: null,
    requiredEntitlement: null,
    title: "First post",
    type: "post",
    ...overrides,
  };
}

function createDeps(
  overrides: {
    emails?: readonly string[];
    entries?: readonly DigestEntry[];
    failFor?: ReadonlySet<string>;
    name?: string | null;
  } = {},
) {
  const calls = {
    errorLines: [] as string[],
    lines: [] as string[],
    listEntries: [] as { since: Date; type: string | null; workspaceId: string }[],
    listMemberEmails: [] as string[],
    sends: [] as TransactionalEmail[],
    workspaceName: [] as string[],
  };
  const deps = {
    async listEntries(input: { since: Date; type: string | null; workspaceId: string }) {
      calls.listEntries.push(input);
      return overrides.entries ?? [];
    },
    async listMemberEmails(workspaceId: string) {
      calls.listMemberEmails.push(workspaceId);
      return overrides.emails ?? [];
    },
    log(line: string) {
      calls.lines.push(line);
    },
    logError(line: string) {
      calls.errorLines.push(line);
    },
    async send(input: TransactionalEmail) {
      calls.sends.push(input);
      if (overrides.failFor?.has(input.to) === true) {
        throw new Error("delivery failed");
      }
      return { id: "del_1", status: "queued" as const, ...input };
    },
    track: dependencies.track,
    async workspaceName(workspaceId: string) {
      calls.workspaceName.push(workspaceId);
      return overrides.name === undefined ? "Acme" : overrides.name;
    },
  };
  return { calls, handler: createEmailDigestHandler(deps) };
}

beforeEach(() => {
  dependencies.captureException.mockReset();
  dependencies.send.mockReset();
  dependencies.track.mockReset();
});

describe("parseDigestInput", () => {
  it("returns defaults for missing or non-object input", () => {
    for (const raw of [undefined, null, {}, "x", 42, [], { lookbackDays: "7" }]) {
      expect(parseDigestInput(raw)).toEqual({ lookbackDays: 7, type: null });
    }
  });

  it("honors a valid lookbackDays and type", () => {
    expect(parseDigestInput({ lookbackDays: 14, type: "report" })).toEqual({
      lookbackDays: 14,
      type: "report",
    });
    // The 1–90 bounds are inclusive.
    expect(parseDigestInput({ lookbackDays: 1 }).lookbackDays).toBe(1);
    expect(parseDigestInput({ lookbackDays: 90 }).lookbackDays).toBe(90);
  });

  it.each([0, 91, 1.5, Number.NaN, -3])(
    "falls back to the default window for lookbackDays=%s",
    (days) => {
      expect(parseDigestInput({ lookbackDays: days }).lookbackDays).toBe(7);
    },
  );

  it("normalizes type through the content-type contract, else null", () => {
    // Lowercased + bounded by normalizeContentType — same rule as entries.
    expect(parseDigestInput({ type: "Report" }).type).toBe("report");
    expect(parseDigestInput({ type: "kb_article" }).type).toBe("kb_article");
    for (const bad of ["", "   ", "bad type!", 42, null]) {
      expect(parseDigestInput({ type: bad }).type).toBeNull();
    }
  });
});

describe("buildDigestMessage", () => {
  it("names the workspace and lookback window in the subject", () => {
    expect(
      buildDigestMessage({ entries: [], lookbackDays: 7, workspaceName: "Acme" }).subject,
    ).toBe("Content digest — Acme (last 7 days)");
    expect(
      buildDigestMessage({ entries: [], lookbackDays: 1, workspaceName: "Acme" }).subject,
    ).toBe("Content digest — Acme (last day)");
  });

  it("lists entries in order with type markers, tier tags, and excerpt lines", () => {
    const { text } = buildDigestMessage({
      entries: [
        entry({ title: "First post", type: "post" }),
        entry({
          excerpt: "Numbers inside.",
          requiredEntitlement: "pro",
          title: "Quarterly report",
          type: "report",
        }),
        entry({ requiredEntitlement: "team", title: "Handbook", type: "doc" }),
      ],
      lookbackDays: 7,
      workspaceName: "Acme",
    });
    const lines = text.split("\n");
    const first = lines.indexOf("• First post (post)");
    const report = lines.indexOf("• Quarterly report (report) [pro tier]");
    const handbook = lines.indexOf("• Handbook (doc) [team tier]");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(report).toBeGreaterThanOrEqual(0);
    expect(handbook).toBeGreaterThanOrEqual(0);
    // Entry order is preserved; the excerpt sits right under its entry.
    expect(first).toBeLessThan(report);
    expect(report).toBeLessThan(handbook);
    expect(lines[report + 1]).toBe("  Numbers inside.");
    // Ungated entries carry no tier tag; excerpt-less entries emit no line.
    expect(lines[first + 1]).toBe("• Quarterly report (report) [pro tier]");
    expect(text).not.toContain("(post) [");
  });

  it("collapses whitespace in titles and excerpts to keep one line each", () => {
    const { text } = buildDigestMessage({
      entries: [
        entry({
          excerpt: "Line one.\n  Line two.\tLine   three.",
          title: "  Multi\nline   title ",
        }),
      ],
      lookbackDays: 7,
      workspaceName: "Acme",
    });
    const lines = text.split("\n");
    expect(lines).toContain("• Multi line title (post)");
    // A raw text excerpt's internal newlines would otherwise emit
    // unindented continuation lines — the collapse keeps one line.
    expect(lines).toContain("  Line one. Line two. Line three.");
    expect(lines.filter((line) => line.startsWith("Line"))).toHaveLength(0);
  });

  it("caps long excerpts at 200 chars with a trailing ellipsis", () => {
    const long = "x".repeat(250);
    const { text } = buildDigestMessage({
      entries: [entry({ excerpt: long })],
      lookbackDays: 7,
      workspaceName: "Acme",
    });
    expect(text).toContain(`  ${"x".repeat(200)}…`);
    expect(text).not.toContain("x".repeat(201));
  });

  it("drops whitespace-only excerpt lines entirely", () => {
    const { text } = buildDigestMessage({
      entries: [entry({ excerpt: "   \n\t  " })],
      lookbackDays: 7,
      workspaceName: "Acme",
    });
    expect(text.split("\n")).toHaveLength(2); // header + entry line only
    expect(text).toContain("• First post (post)");
  });
});

describe("createEmailDigestHandler", () => {
  it("logs a skip and does no work for a platform (null-workspace) schedule", async () => {
    const { calls, handler } = createDeps({
      emails: ["a@example.test"],
      entries: [entry()],
    });

    await handler({}, { ...CTX, workspaceId: null });
    expect(calls.lines).toHaveLength(1);
    expect(calls.lines[0]).toContain(EMAIL_DIGEST_JOB_TYPE);
    expect(calls.lines[0]).toMatch(/skip/i);
    expect(calls.lines[0]).toContain("sch_1");
    expect(calls.listEntries).toHaveLength(0);
    expect(calls.sends).toHaveLength(0);
    expect(dependencies.track).not.toHaveBeenCalled();
  });

  it("tracks sent:0 and sends nothing when the window has no entries", async () => {
    const { calls, handler } = createDeps({ emails: ["a@example.test"], entries: [] });

    await handler({}, CTX);
    expect(calls.sends).toHaveLength(0);
    // No members or workspace name are fetched when there is nothing to send.
    expect(calls.listMemberEmails).toHaveLength(0);
    expect(calls.workspaceName).toHaveLength(0);
    expect(dependencies.track).toHaveBeenCalledTimes(1);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job.completed",
        properties: expect.objectContaining({ entries: 0, sent: 0 }),
        workspaceId: "ws_1",
      }),
    );
  });

  it("sends one transactional email per member with the built digest", async () => {
    const entries = [
      entry({ title: "First post", type: "post" }),
      entry({ requiredEntitlement: "pro", title: "Quarterly report", type: "report" }),
    ];
    const { calls, handler } = createDeps({
      emails: ["a@example.test", "b@example.test"],
      entries,
      name: "Acme",
    });

    await handler({ lookbackDays: 14, type: "report" }, CTX);

    // The window is computed off the claimed fire time; input filters pass through.
    expect(calls.listEntries).toEqual([
      {
        since: new Date(CTX.now.getTime() - 14 * DAY_MS),
        type: "report",
        workspaceId: "ws_1",
      },
    ]);
    expect(calls.listMemberEmails).toEqual(["ws_1"]);
    expect(calls.workspaceName).toEqual(["ws_1"]);

    expect(calls.sends.map((send) => send.to)).toEqual(["a@example.test", "b@example.test"]);
    for (const send of calls.sends) {
      expect(send.category).toBe("transactional");
      expect(send.workspaceId).toBe("ws_1");
      expect(send.subject).toBe("Content digest — Acme (last 14 days)");
      expect(send.text).toContain("• First post (post)");
      expect(send.text).toContain("• Quarterly report (report) [pro tier]");
    }
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "ws_1",
        name: "job.completed",
        properties: expect.objectContaining({
          entries: 2,
          failed: 0,
          recipients: 2,
          scheduleId: "sch_1",
          sent: 2,
          type: EMAIL_DIGEST_JOB_TYPE,
        }),
        workspaceId: "ws_1",
      }),
    );
  });

  it("counts a per-recipient failure without aborting the remaining sends", async () => {
    const { calls, handler } = createDeps({
      emails: ["a@example.test", "b@example.test", "c@example.test"],
      entries: [entry()],
      failFor: new Set(["b@example.test"]),
    });

    await handler({}, CTX);
    expect(calls.sends.map((send) => send.to)).toEqual([
      "a@example.test",
      "b@example.test",
      "c@example.test",
    ]);
    // The failure lands on the error sink, not the informational log.
    expect(calls.errorLines).toHaveLength(1);
    expect(calls.errorLines[0]).toContain(EMAIL_DIGEST_JOB_TYPE);
    expect(calls.lines).toHaveLength(0);
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          entries: 1,
          failed: 1,
          recipients: 3,
          sent: 2,
        }),
      }),
    );
  });

  it("carries the job correlationId into job.completed when the run context has one", async () => {
    const { handler } = createDeps({ emails: [], entries: [] });

    await handler({}, { ...CTX, correlationId: "corr_digest-1" });
    expect(dependencies.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job.completed",
        properties: expect.objectContaining({ correlationId: "corr_digest-1" }),
      }),
    );
  });

  it("omits correlationId from job.completed when the run context has none", async () => {
    const { handler } = createDeps({ emails: [], entries: [] });

    await handler({}, CTX);
    const event = dependencies.track.mock.calls[0]![0];
    expect(event.properties).not.toHaveProperty("correlationId");
  });

  it("falls back to a generic workspace name when the row is gone", async () => {
    const { calls, handler } = createDeps({
      emails: ["a@example.test"],
      entries: [entry()],
      name: null,
    });

    await handler({}, CTX);
    expect(calls.sends).toHaveLength(1);
    expect(calls.sends[0]!.subject).toBe("Content digest — your workspace (last 7 days)");
  });
});

describe("emailDigestHandler", () => {
  it("is the runtime JobHandler the registry lazy-imports", () => {
    expect(emailDigestHandler).toEqual(expect.any(Function));
  });

  it("keeps the exported type literal aligned with the registry key", async () => {
    expect(EMAIL_DIGEST_JOB_TYPE).toBe("email.digest");
    // The registry literal and this export must not drift — pin both.
    const { JOB_HANDLERS } = await import("./job-handlers");
    expect(JOB_HANDLERS[EMAIL_DIGEST_JOB_TYPE]).toEqual(expect.any(Function));
  });
});
