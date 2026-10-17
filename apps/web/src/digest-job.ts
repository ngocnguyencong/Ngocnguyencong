import "server-only";

import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { parseServerConfig } from "@supastack/config";
import { contentEntry, user, workspace, workspaceMembership } from "@supastack/db";
import type { EmailSender } from "@supastack/email";
import type { AnalyticsEvent } from "@supastack/observability";

import { database } from "./auth-runtime";
import { normalizeContentType } from "./content";
import type { JobHandler } from "./job-handlers";
import { serverObservability } from "./observability-runtime";
import { createServerTransactionalEmailSender } from "./server-provider-composition";

/** Workspace job type for periodic content digests — the example Settings → Developers suggests. */
export const EMAIL_DIGEST_JOB_TYPE = "email.digest";

export const DEFAULT_DIGEST_LOOKBACK_DAYS = 7;
export const MAX_DIGEST_LOOKBACK_DAYS = 90;
/** One digest never lists more than this many entries. */
export const MAX_DIGEST_ENTRIES = 50;
/**
 * Bound on the per-fire member fan-out: under `JOB_PROVIDER=local` a claimed
 * schedule has a per-handler dispatch budget (`JOB_HANDLER_TIMEOUT_MS`), and
 * sequential sends must stay well under it. A workspace larger than this
 * gets a truncated recipient list — the run still completes and reports the
 * fetched count as `recipients`.
 */
export const MAX_DIGEST_RECIPIENTS = 100;
const DAY_MS = 86_400_000;
/** Excerpt lines collapse to one line and cap at this length (+ "…"). */
const MAX_EXCERPT_LENGTH = 200;

/** A published content entry as the digest lists it — no body, just metadata. */
export type DigestEntry = Readonly<{
  excerpt: string | null;
  requiredEntitlement: string | null;
  title: string;
  type: string;
}>;

export type DigestInput = Readonly<{
  /** Whole days of history to include; integer 1–90, default 7. */
  lookbackDays: number;
  /** Optional single content-type filter (normalized like entry types). */
  type: string | null;
}>;

/**
 * Validates the `job_schedule.input` payload for `email.digest`. Malformed
 * or missing fields fall back to defaults — a bad stored payload must not
 * poison the schedule run (`runJobHandler` reports thrown errors as
 * dispatch failures, and nothing else validates `input` on the way in).
 */
export function parseDigestInput(raw: unknown): DigestInput {
  if (!isRecord(raw)) {
    return { lookbackDays: DEFAULT_DIGEST_LOOKBACK_DAYS, type: null };
  }
  const lookbackDays =
    Number.isInteger(raw.lookbackDays) &&
    (raw.lookbackDays as number) >= 1 &&
    (raw.lookbackDays as number) <= MAX_DIGEST_LOOKBACK_DAYS
      ? (raw.lookbackDays as number)
      : DEFAULT_DIGEST_LOOKBACK_DAYS;
  // Non-string/unsafe types (bad characters, >64 chars) normalize to null —
  // the digest then covers every type instead of failing.
  return { lookbackDays, type: normalizeContentType(raw.type) };
}

export type DigestMessage = Readonly<{ subject: string; text: string }>;

/**
 * Plain-text digest body — `createServerTransactionalEmailSender`'s shared
 * HTML template wraps it for the branded render. Entries keep their query
 * order (newest first); entitlement-gated entries are included and tagged
 * `[<key> tier]` because the recipients are the publishing team itself.
 * Titles/excerpts are whitespace-collapsed (raw `excerpt` is `text` —
 * internal newlines would otherwise produce unindented continuation lines)
 * and excerpts are capped at {@link MAX_EXCERPT_LENGTH} + "…".
 */
export function buildDigestMessage(input: {
  entries: readonly DigestEntry[];
  lookbackDays: number;
  workspaceName: string;
}): DigestMessage {
  const window = input.lookbackDays === 1 ? "day" : `${input.lookbackDays} days`;
  const subject = `Content digest — ${input.workspaceName} (last ${window})`;
  const lines = [`New published entries in ${input.workspaceName} (last ${window}):`];
  for (const entry of input.entries) {
    const tier = entry.requiredEntitlement === null ? "" : ` [${entry.requiredEntitlement} tier]`;
    lines.push(`• ${collapseWhitespace(entry.title)} (${entry.type})${tier}`);
    if (entry.excerpt !== null && entry.excerpt.length > 0) {
      const excerpt = collapseWhitespace(entry.excerpt);
      if (excerpt.length > 0) {
        lines.push(`  ${truncateExcerpt(excerpt)}`);
      }
    }
  }
  return { subject, text: lines.join("\n") };
}

export interface EmailDigestDependencies {
  /**
   * Member emails for the workspace (`workspace_membership ⋈ user`),
   * capped at {@link MAX_DIGEST_RECIPIENTS} — sequential sends must stay
   * inside the per-handler dispatch budget.
   */
  listMemberEmails(workspaceId: string): Promise<readonly string[]>;
  /**
   * Published entries for the workspace whose `publishedAt` is within the
   * window — `status="published"`, `publishedAt >= since`, optional type
   * equality, newest first, capped at {@link MAX_DIGEST_ENTRIES}.
   */
  listEntries(input: {
    since: Date;
    type: string | null;
    workspaceId: string;
  }): Promise<readonly DigestEntry[]>;
  /** Informational sink (skips) — defaults to `console.log`. */
  log?(line: string): void;
  /** Failure-line sink (per-recipient send failures) — defaults to `console.error`. */
  logError?(line: string): void;
  /** Transactional sender — one `category:"transactional"` mail per member. */
  send: EmailSender["send"];
  /** Completion metrics sink — defaults to `serverObservability.track`. */
  track?(event: AnalyticsEvent): void;
  /** Workspace display name for the copy; null falls back to a generic name. */
  workspaceName(workspaceId: string): Promise<string | null>;
}

/**
 * Builds the `email.digest` handler with injectable dependencies. Workspace
 * job by contract: a platform schedule (null `workspaceId`) has no member
 * list to address, so it logs a skip instead of failing — the type is
 * deliberately NOT in `PLATFORM_JOB_TYPES` (workspace schedules are allowed
 * to register it) and NOT wrapped in `platformOnly`.
 */
export function createEmailDigestHandler(deps: EmailDigestDependencies): JobHandler {
  return async (input, ctx) => {
    if (ctx.workspaceId === null) {
      deps.log?.(
        `[${EMAIL_DIGEST_JOB_TYPE}] skipped — workspace job invoked for a platform schedule scheduleId=${ctx.scheduleId}`,
      );
      return;
    }
    const workspaceId = ctx.workspaceId;
    const { lookbackDays, type } = parseDigestInput(input);
    const since = new Date(ctx.now.getTime() - lookbackDays * DAY_MS);
    const entries = await deps.listEntries({ since, type, workspaceId });
    const completed = (metrics: Record<string, unknown>) => {
      deps.track?.({
        distinctId: workspaceId,
        name: "job.completed",
        properties: {
          ...metrics,
          // Joins this run's event to the dispatch that minted it — the job
          // context carries an opaque `corr_<uuid>` (absent on legacy paths).
          ...(ctx.correlationId === undefined ? {} : { correlationId: ctx.correlationId }),
          scheduleId: ctx.scheduleId,
          type: EMAIL_DIGEST_JOB_TYPE,
        },
        workspaceId,
      });
    };
    if (entries.length === 0) {
      // An empty window is a successful, quiet run — no member lookups or
      // sends happen, but the completion event still lands.
      completed({ entries: 0, failed: 0, sent: 0 });
      return;
    }

    const [name, memberEmails] = await Promise.all([
      deps.workspaceName(workspaceId),
      deps.listMemberEmails(workspaceId),
    ]);
    const { subject, text } = buildDigestMessage({
      entries,
      lookbackDays,
      workspaceName: name ?? "your workspace",
    });

    let sent = 0;
    let failed = 0;
    // Sequential sends — a small, predictable burst matching the local
    // dispatch loop; one bad recipient never starves the rest.
    for (const to of memberEmails) {
      try {
        await deps.send({ category: "transactional", subject, text, to, workspaceId });
        sent += 1;
      } catch {
        deps.logError?.(
          `[${EMAIL_DIGEST_JOB_TYPE}] member send failed — scheduleId=${ctx.scheduleId} workspaceId=${workspaceId}`,
        );
        failed += 1;
      }
    }
    completed({
      entries: entries.length,
      failed,
      recipients: memberEmails.length,
      sent,
    });
  };
}

/**
 * The registered `email.digest` handler. Dependencies are composed per fire
 * so module load stays light and env parsing/provider construction happens
 * inside the run — a skipped (platform) or empty digest never pays for the
 * sender composition.
 */
export const emailDigestHandler: JobHandler = async (input, ctx) => {
  let sender: EmailSender | null = null;
  const handler = createEmailDigestHandler({
    async listEntries({ since, type, workspaceId }) {
      const conditions = [
        eq(contentEntry.workspaceId, workspaceId),
        eq(contentEntry.status, "published"),
        isNotNull(contentEntry.publishedAt),
        gte(contentEntry.publishedAt, since),
      ];
      if (type !== null) {
        conditions.push(eq(contentEntry.type, type));
      }
      return database
        .select({
          excerpt: contentEntry.excerpt,
          requiredEntitlement: contentEntry.requiredEntitlement,
          title: contentEntry.title,
          type: contentEntry.type,
        })
        .from(contentEntry)
        .where(and(...conditions))
        .orderBy(desc(contentEntry.publishedAt))
        .limit(MAX_DIGEST_ENTRIES);
    },
    async listMemberEmails(workspaceId) {
      const rows = await database
        .select({ email: user.email })
        .from(workspaceMembership)
        .innerJoin(user, eq(user.id, workspaceMembership.userId))
        .where(eq(workspaceMembership.workspaceId, workspaceId))
        .limit(MAX_DIGEST_RECIPIENTS);
      return rows.map((row) => row.email);
    },
    // Informational lines (skips) go to console.log; per-recipient send
    // failures go to console.error — same sinks as scheduler.ping's log.
    log: (line) => console.log(line),
    logError: (line) => console.error(line),
    send(email) {
      sender ??= createServerTransactionalEmailSender(parseServerConfig().providers.email);
      return sender.send(email);
    },
    track: (event) => serverObservability.track(event),
    async workspaceName(workspaceId) {
      const [row] = await database
        .select({ name: workspace.name })
        .from(workspace)
        .where(eq(workspace.id, workspaceId))
        .limit(1);
      return row?.name ?? null;
    },
  });
  await handler(input, ctx);
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Single-line-safe copy: collapses all whitespace runs to one space. */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateExcerpt(value: string): string {
  return value.length > MAX_EXCERPT_LENGTH
    ? `${value.slice(0, MAX_EXCERPT_LENGTH).trimEnd()}…`
    : value;
}
