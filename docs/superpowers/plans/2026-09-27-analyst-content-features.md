# Analyst-Product Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three capabilities for content/analyst-type products built on the kit: (1) subscription-tier gating on CMS entries (`content_entry`), (2) a working scheduled-digest example (`email.digest` job type), (3) data-visualization kit blocks usable on marketing and app surfaces.

**Architecture:**

- Paywall: one nullable `required_entitlement` column on `content_entry`, normalized through the existing `normalizeContentEntryInput`, enforced at the `listPublishedContentEntries` public read boundary (locked rows lose their `body`), powered by the existing `entitlement` ledger + `hasActiveEntitlement` pure check.
- Digest: a workspace-scoped job handler registered under the already-documented `email.digest` type in the built-in `JOB_HANDLERS` registry; mails published entries from a lookback window to workspace members through the existing transactional email composition.
- Viz blocks: a new `shared` block surface (`src/kit/blocks/shared/`) rendered under both `.app-theme` and `.marketing-theme` wrappers on `/kit-blocks`; pure-SVG server components, theme tokens + `color-mix` only, no client JS.

**Tech Stack:** Next.js App Router (v16 — read `node_modules/next/dist/docs/` notes if unsure of an API), React 19, Drizzle ORM (`packages/db`), Vitest, React Email, CSS Modules, `lucide-react`.

**Repo rules that apply to every task:**

- `.ai/` mirror docs: every touched file needs its mirror at `.ai/<same-path-with-.md>` read before editing and updated after (create if missing). Mirrors must never reference other repositories or maintainer-only checkouts.
- Test-first development for behavior.
- Every user-owned record stays `workspaceId`-scoped.
- The working tree already contains unrelated uncommitted changes — **stage only the exact files you touched** (`git add <paths>`; never `git add -A`/`git commit -a`).
- Conventional-commit style messages; do NOT push, merge, or run `pnpm sync:subrepos`.

---

### Task 1: Tier-gated content backend (`required_entitlement`)

**Files:**

- Modify: `packages/db/src/schema.ts` (`contentEntry` table, ~line 878)
- Create: `packages/db/drizzle/0012_*.sql` + `packages/db/drizzle/meta/0012_snapshot.json` via `pnpm --filter @supastack/db db:generate`
- Modify: `apps/web/src/content.ts`
- Modify: `apps/web/src/content-actions.ts`
- Create: `apps/web/src/entitlements.ts`
- Modify: `apps/web/src/entitlement-gate.tsx` (refactor to shared loader — no behavior change)
- Test: `apps/web/src/content.test.ts` (extend), `apps/web/src/content-access.test.ts` (new)
- Mirrors: `.ai/packages/db/src/schema.md`, `.ai/packages/db/drizzle/0012_<name>.md` (new), `.ai/apps/web/src/content.md`, `.ai/apps/web/src/content-actions.md`, `.ai/apps/web/src/entitlements.md` (new), `.ai/apps/web/src/entitlement-gate.md` (new — file currently has no mirror), `.ai/apps/web/src/content.test.md`, `.ai/apps/web/src/content-access.test.md` (new)

**Context:** `content_entry` is the workspace CMS table (post/page/doc/…). `entitlement` rows carry `key`/`status`/`expiresAt` per workspace; `hasActiveEntitlement` in `apps/web/src/entitlement-check.ts` is the pure check (`active`/`trialing`, `expiresAt` null-or-future). `listPublishedContentEntries` is the PUBLIC read boundary product surfaces render from — it takes an explicit `workspaceId` and needs no session, so gating must be an explicit opt-in parameter: callers that pass no viewer entitlements still see metadata but locked bodies come back stripped.

- [x] **Step 1: Schema column + migration**

In `packages/db/src/schema.ts`, add to `contentEntry` columns (after `publishedAt`):

```ts
/** Minimum subscription tier required to read the body; NULL = free for every reader. */
requiredEntitlement: varchar("required_entitlement", { length: 100 }),
```

Then run `pnpm --filter @supastack/db db:generate` to emit `0012_<name>.sql` + snapshot, and `pnpm --filter @supastack/db test` to confirm the artifact contract tests stay green (they iterate journal entries; no pinned list edit needed).

- [x] **Step 2: Failing tests — normalization + access decision**

In `apps/web/src/content.test.ts` add cases to the `normalizeContentEntryInput` describe:

```ts
it("normalizes requiredEntitlement: trims, lowercases, nulls blanks, rejects unsafe keys", () => {
  expect(
    normalizeContentEntryInput({ title: "T", type: "post", requiredEntitlement: "  Pro " }),
  ).toMatchObject({ requiredEntitlement: "pro" });
  expect(
    normalizeContentEntryInput({ title: "T", type: "post", requiredEntitlement: "" }),
  ).toMatchObject({ requiredEntitlement: null });
  expect(normalizeContentEntryInput({ title: "T", type: "post" })).toMatchObject({
    requiredEntitlement: null,
  });
  expect(
    normalizeContentEntryInput({ title: "T", type: "post", requiredEntitlement: "pro tier!" }),
  ).toEqual({ error: expect.any(String) });
});
```

Create `apps/web/src/content-access.test.ts` — pure unit tests for the new helpers (no DB):

```ts
import { describe, expect, it } from "vitest";
import { applyContentAccess, isContentLocked } from "./content-access";

const now = new Date("2026-09-27T12:00:00Z");
const row = (over = {}) => ({
  body: "full report body",
  excerpt: "teaser",
  id: "con_1",
  publishedAt: now,
  requiredEntitlement: "pro",
  slug: "q3-report",
  title: "Q3 report",
  type: "report",
  ...over,
});

describe("isContentLocked", () => {
  it("never locks free entries", () => {
    expect(isContentLocked(null, [], now)).toBe(false);
  });
  it("locks gated entries without a matching active entitlement", () => {
    expect(isContentLocked("pro", [], now)).toBe(true);
    expect(isContentLocked("pro", [{ key: "pro", status: "past_due", expiresAt: null }], now)).toBe(
      true,
    );
  });
  it("unlocks with a matching active/trialing entitlement", () => {
    expect(isContentLocked("pro", [{ key: "pro", status: "active", expiresAt: null }], now)).toBe(
      false,
    );
    expect(
      isContentLocked(
        "pro",
        [{ key: "pro", status: "trialing", expiresAt: new Date("2026-10-01") }],
        now,
      ),
    ).toBe(false);
  });
});

describe("applyContentAccess", () => {
  it("strips body and marks locked rows", () => {
    const [locked] = applyContentAccess([row()], [], now);
    expect(locked).toMatchObject({ locked: true, body: "", requiredEntitlement: "pro" });
  });
  it("passes rows through when entitled or ungated", () => {
    const entitlements = [{ key: "pro", status: "active" as const, expiresAt: null }];
    expect(applyContentAccess([row()], entitlements, now)[0]).toMatchObject({
      locked: false,
      body: "full report body",
    });
    expect(applyContentAccess([row({ requiredEntitlement: null })], [], now)[0]).toMatchObject({
      locked: false,
    });
  });
});
```

- [x] **Step 3: Implement**

`apps/web/src/content.ts`:

- Add `"report"` to `CONTENT_ENTRY_TYPES` (analyst use-case).
- `ContentEntryDraft` gains `requiredEntitlement: string | null`.
- `normalizeContentEntryInput` accepts `requiredEntitlement?: string` in `raw`; normalize: `trim().toLowerCase()`, `""` → `null`; reject values failing `/^[a-z0-9][a-z0-9_-]*$/` or length > 100 with error `"An entitlement key of 1-100 lowercase letters, digits, dashes, or underscores is required."` Return it on the draft.

New `apps/web/src/content-access.ts` (pure, no DB/react imports):

```ts
import { hasActiveEntitlement, type EntitlementRecord } from "./entitlement-check";

/** True when the row requires an entitlement the viewer does not hold. */
export function isContentLocked(
  requiredEntitlement: string | null,
  viewerEntitlements: readonly EntitlementRecord[],
  now: Date = new Date(),
): boolean {
  return (
    requiredEntitlement !== null &&
    !hasActiveEntitlement(viewerEntitlements, requiredEntitlement, now)
  );
}

/**
 * Projects raw rows for a reader: gated rows keep teaser metadata but lose
 * `body` — the server never ships locked bodies to the wire.
 */
export function applyContentAccess<
  Row extends { body: string; requiredEntitlement: string | null },
>(
  rows: readonly Row[],
  viewerEntitlements: readonly EntitlementRecord[],
  now: Date = new Date(),
): readonly (Row & { locked: boolean })[] {
  return rows.map((row) => {
    const locked = isContentLocked(row.requiredEntitlement, viewerEntitlements, now);
    return { ...row, body: locked ? "" : row.body, locked };
  });
}
```

New `apps/web/src/entitlements.ts` (server-only loader shared by gates and content surfaces):

```ts
import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { entitlement } from "@supastack/db";

import { database, getAuthSession } from "./auth-runtime";
import type { EntitlementRecord } from "./entitlement-check";
import { resolveActiveWorkspaceIdForUser } from "./organization-actions";

export async function listWorkspaceEntitlements(workspaceId: string): Promise<EntitlementRecord[]> {
  return database
    .select({
      expiresAt: entitlement.expiresAt,
      key: entitlement.key,
      status: entitlement.status,
    })
    .from(entitlement)
    .where(eq(entitlement.workspaceId, workspaceId));
}

/**
 * The signed-in viewer's active workspace + its entitlement rows. Anonymous
 * viewers get `{ workspaceId: null, entitlements: [] }` — surfaces then treat
 * every gated entry as locked.
 */
export async function listViewerEntitlements(): Promise<{
  entitlements: EntitlementRecord[];
  workspaceId: string | null;
}> {
  const session = await getAuthSession(await headers());
  const workspaceId =
    session === null ? null : ((await resolveActiveWorkspaceIdForUser(session.user.id)) ?? null);
  if (workspaceId === null) return { entitlements: [], workspaceId: null };
  return { entitlements: await listWorkspaceEntitlements(workspaceId), workspaceId };
}
```

`apps/web/src/entitlement-gate.tsx`: replace the inline entitlement query with `listWorkspaceEntitlements(workspaceId)` from `./entitlements` (keep the session/`resolveActiveWorkspaceIdForUser` flow identical in behavior — it may now delegate to `listViewerEntitlements` when that exactly matches).

`apps/web/src/content-actions.ts`:

- `ContentEntryRow` gains `requiredEntitlement: string | null`.
- `createContentEntryAction`/`updateContentEntryAction` take `requiredEntitlement?: string` in input, pass through `normalizeContentEntryInput`, persist the normalized value (`updateContentEntryAction` sets it unconditionally like the other fields — blank clears the gate).
- `listContentEntries` selects `requiredEntitlement`.
- `listPublishedContentEntries` gains `viewerEntitlements?: readonly EntitlementRecord[]` (default `[]`), selects `requiredEntitlement`, and returns `applyContentAccess(rows, viewerEntitlements)` so each row carries `locked` and a stripped `body` when locked. Update the doc comment: published entries are public metadata; bodies are gated per-entitlement. Return type widens to `(ContentEntryRow & { locked: boolean })[]`.

- [x] **Step 4: Verify**

Run: `pnpm --filter @supastack/db test && pnpm --filter @supastack/web test -- src/content.test.ts src/content-access.test.ts src/entitlement-gate.test.ts`
Expected: all green.

- [x] **Step 5: Mirrors + commit**

Update/create the `.ai` mirrors listed above. In `.ai/packages/db/src/schema.md` add a Change History row for `required_entitlement`; note in `.ai/apps/web/src/content-actions.md` that `listPublishedContentEntries` strips locked bodies (the security-relevant contract). Commit ONLY the files you touched:

```bash
git add packages/db/src/schema.ts packages/db/drizzle/0012_* packages/db/drizzle/meta/0012_* packages/db/drizzle/meta/_journal.json apps/web/src/content.ts apps/web/src/content-actions.ts apps/web/src/content-access.ts apps/web/src/content-access.test.ts apps/web/src/entitlements.ts apps/web/src/entitlement-gate.tsx apps/web/src/content.test.ts .ai/
```

(`git add` each path explicitly — the tree has unrelated dirty files that must stay uncommitted.)

```bash
git commit -m "feat(content): tier-gate CMS entries by workspace entitlement"
```

---

### Task 2: Content admin field + `paywall-gate` kit block

**Files:**

- Modify: `apps/web/src/web-content-page.tsx`
- Create: `apps/web/src/kit/blocks/app/paywall-gate.tsx` + `paywall-gate.module.css`
- Modify: `apps/web/src/kit/blocks.ts`
- Modify: `apps/web/app/kit-blocks/page.tsx` (app-surface demo)
- Mirrors: `.ai/apps/web/src/web-content-page.md`, `.ai/apps/web/src/kit/blocks.md`, `.ai/apps/web/src/kit/blocks/app/paywall-gate.md` (new), `.ai/apps/web/app/kit-blocks/page.md` (create if missing — check first)

**Context:** `/content` (`web-content-page.tsx`) is the member-facing CMS admin. The new `requiredEntitlement` field from Task 1 needs a form control + list badge. The block library rules: token-only CSS (`var(--*)`, `color-mix`), no kit imports, semantic HTML, `files` array lists every file to copy. Internal structural glyphs may import `lucide-react` directly (precedent: minimal set's Check/ChevronDown).

- [x] **Step 1: Admin form + badge**

`web-content-page.tsx`:

- `submitEntry` payload gains `requiredEntitlement: text("requiredEntitlement")`.
- Form: after the Locale field add:

```tsx
<label htmlFor="content-entitlement">Required entitlement (blank = free for all readers)</label>
<input
  defaultValue={editing?.requiredEntitlement ?? ""}
  disabled={pending}
  id="content-entitlement"
  list="content-entitlement-options"
  maxLength={100}
  name="requiredEntitlement"
  placeholder="pro"
/>
<datalist id="content-entitlement-options">
  <option value="pro" />
</datalist>
```

- Entry row: render `<span className="status-badge">{entry.requiredEntitlement}</span>` next to the existing type badge when non-null.

- [x] **Step 2: `paywall-gate` block**

`paywall-gate.tsx` — server component, no client directive:

```tsx
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./paywall-gate.module.css";

export type PaywallGateProps = {
  /** Upgrade destination. */
  cta: { href: string; label: string };
  /** Optional teaser excerpt shown above the fold line. */
  excerpt?: string | undefined;
  /** Entitlement/plan label shown in the prompt (e.g. "Pro"). */
  requiredTier: string;
  /** Optional faded preview content (already-safe teaser markup). */
  preview?: ReactNode | undefined;
  title?: string | undefined;
};

/** Kit block — locked-content teaser with an upgrade CTA. Pairs with gated CMS entries. */
export function PaywallGate({ cta, excerpt, preview, requiredTier, title }: PaywallGateProps) {
  return (
    <section className={styles.gate} aria-label="Locked content">
      {preview !== undefined ? (
        <div className={styles.preview} aria-hidden="true">
          {preview}
        </div>
      ) : null}
      <div className={styles.panel}>
        <span className={styles.icon} aria-hidden="true">
          <Lock size={16} />
        </span>
        {title !== undefined ? <h3 className={styles.title}>{title}</h3> : null}
        <p className={styles.copy}>
          {excerpt !== undefined ? <>{excerpt} </> : null}
          This {requiredTier} content is available to subscribers on the {requiredTier} plan.
        </p>
        <a className={styles.cta} href={cta.href}>
          {cta.label}
        </a>
      </div>
    </section>
  );
}
```

CSS in the established token style (`var(--raised)`, `var(--border)`, `var(--accent)`, `var(--radius-card, 16px)`, muted copy, ≥44px CTA, `.preview` gets a gradient fade via `mask-image: linear-gradient(to bottom, black, transparent)` + `max-height` cap). Copy wording may be tuned; keep it generic.

- [x] **Step 3: Register + showcase**

`blocks.ts` entry after `otp-input` (app surface):

```ts
{
  id: "paywall-gate",
  name: "Paywall gate",
  description: "Locked-content teaser — faded preview, lock chip, upgrade CTA for gated CMS entries.",
  surface: "app",
  files: [
    "apps/web/src/kit/blocks/app/paywall-gate.tsx",
    "apps/web/src/kit/blocks/app/paywall-gate.module.css",
  ],
},
```

`kit-blocks/page.tsx`: import + render a demo cell for `block.id === "paywall-gate"` with sample props (excerpt + preview stub + `cta={{href:"#",label:"Upgrade to Pro"}} requiredTier="Pro"`).

- [x] **Step 4: Verify + mirrors + commit**

Run: `pnpm --filter @supastack/web test -- src/kit/blocks.test.ts` and typecheck (`pnpm --filter @supastack/web typecheck` or the package's script). Update mirrors. Commit only your files: `feat(kit): content entitlement field + paywall-gate block`.

---

### Task 3: `email.digest` scheduled digest example

**Files:**

- Create: `apps/web/src/digest-job.ts`
- Modify: `apps/web/src/job-handlers.ts`
- Create: `apps/web/src/digest-job.test.ts`
- Modify: `apps/web/src/job-handlers.test.ts` (pin registration)
- Modify: `apps/web/src/resources/additional-guides.ts` (new `modules/scheduled-digest` guide, group "AI and operations")
- Mirrors: `.ai/apps/web/src/digest-job.md` (new), `.ai/apps/web/src/digest-job.test.md` (new), `.ai/apps/web/src/job-handlers.md`, `.ai/apps/web/src/job-handlers.test.md`, `.ai/apps/web/src/resources/additional-guides.md`

**Context:** `job_schedule` rows with `workspaceId` set are workspace schedules; `upsertScheduleAction` (Settings → Developers) already suggests `email.digest` as a type — but no handler exists, so scheduling it 500s as "Unknown job type". Built-in registry lives in `mutableJobHandlers` in `job-handlers.ts`; workspace handlers are NOT in `PLATFORM_JOB_TYPES` and must no-op on `ctx.workspaceId === null`. Email goes through `createServerTransactionalEmailSender` (see `notification-runtime.ts`) — `HtmlTemplatedEmailSender` wraps text into the branded HTML template for free. Members come from `workspaceMembership` ⋈ `user`.

- [x] **Step 1: Failing tests** — `apps/web/src/digest-job.test.ts`

Test the pure seams and the injected handler (deps fully in-memory; no DB):

```ts
// parseDigestInput: default 7d lookback; bounds 1..90; accepts {type:"report"}
// buildDigestMessage: subject names the window; body lists "• Title (type)" lines,
//   appends [tier] for gated entries, omits empty bodies; entry order preserved
// createEmailDigestHandler:
//   - ctx.workspaceId === null → logs + sends nothing
//   - zero entries in window → track({sent:0}) + no sends
//   - sends one transactional email per member email; per-recipient failure
//     counts failed but doesn't abort others
```

- [x] **Step 2: Implement** `apps/web/src/digest-job.ts`

```ts
import "server-only";

import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { contentEntry, user, workspaceMembership } from "@supastack/db";
import type { AnalyticsEvent } from "@supastack/observability";
import type { EmailSender } from "@supastack/email";

import { database } from "./auth-runtime";
import type { JobHandler, JobHandlerContext } from "./job-handlers";
import { serverObservability } from "./observability-runtime";
import { createServerTransactionalEmailSender } from "./server-provider-composition";
import { parseServerConfig } from "@supastack/config";

export const EMAIL_DIGEST_JOB_TYPE = "email.digest";

export type DigestEntry = Readonly<{
  excerpt: string | null;
  publishedAt: Date | null;
  requiredEntitlement: string | null;
  slug: string;
  title: string;
  type: string;
}>;

export type DigestInput = Readonly<{ lookbackDays: number; type: string | null }>;

const DEFAULT_LOOKBACK_DAYS = 7;
const MAX_LOOKBACK_DAYS = 90;

export function parseDigestInput(raw: unknown): DigestInput {
  /* see tests */
}

export function buildDigestMessage(input: {
  entries: readonly DigestEntry[];
  lookbackDays: number;
  workspaceName: string;
}): { subject: string; text: string } {
  /* … */
}

export interface EmailDigestDependencies {
  listEntries(input: {
    since: Date;
    type: string | null;
    workspaceId: string;
  }): Promise<readonly DigestEntry[]>;
  listMemberEmails(workspaceId: string): Promise<readonly string[]>;
  send(input: { subject: string; text: string; to: string }): Promise<unknown>;
  workspaceName(workspaceId: string): Promise<string>;
  log?(line: string): void;
  track?(event: AnalyticsEvent): void;
}

export function createEmailDigestHandler(deps: EmailDigestDependencies): JobHandler {
  /* … */
}

/** Runtime wiring — lazy heavy deps so module load stays cheap. */
export const emailDigestHandler: JobHandler = async (input, ctx) => {
  /* lazy imports + createEmailDigestHandler(defaultDeps) */
};
```

Behavior spec: null workspaceId → `deps.log` skip line + return. Parse input (`{type?, lookbackDays?}`; also accept `lookbackDays` only when integer in range, else default). `since = ctx.now - lookbackDays`. Query published entries `publishedAt >= since` (optionally `type`), newest first, cap 50. Zero entries → `track` `job.completed` `{sent: 0}` + return (never mail an empty digest). Otherwise send each member email `{category:"transactional", subject, text, to, workspaceId}`; per-recipient try/catch counts `failed`; `track` `{entries, failed, sent}`.

- [x] **Step 3: Register + guide**

`job-handlers.ts`: add to `mutableJobHandlers` (after the `createJobHandlers` spread):

```ts
// Workspace example: email the workspace's recently published entries to its
// members. Workspace-scoped by contract — platform schedules (null
// workspaceId) skip inside the handler.
"email.digest": async (input, ctx) => {
  const { emailDigestHandler } = await import("./digest-job");
  await emailDigestHandler(input, ctx);
},
```

`job-handlers.test.ts`: assert `JOB_HANDLERS["email.digest"]` is defined and `PLATFORM_JOB_TYPES` does NOT contain it.

`additional-guides.ts`: append `guide("modules/scheduled-digest", "modules", "AI and operations", "Scheduled content digests", "Email a periodic digest of freshly published content to workspace members.", …)` covering: create a schedule in Settings → Developers with type `email.digest` and a cron like `0 9 * * 1` (weekly Monday 09:00 UTC); the tick path (`POST /api/internal/scheduler-tick` locally / `scheduler.tick` under `JOB_PROVIDER=trigger`); input shape `{type, lookbackDays}`; empty windows send nothing; copy-paste recipe for a product-defined type via `registerJobHandler`.

- [x] **Step 4: Verify + mirrors + commit**

Run: `pnpm --filter @supastack/web test -- src/digest-job.test.ts src/job-handlers.test.ts src/schedule-actions.test.ts src/scheduler-runtime.test.ts` + web typecheck. Update mirrors. Commit: `feat(jobs): email.digest scheduled content digest`.

---

### Task 4: Shared data-visualization blocks

> **Shipped naming:** the `shared` surface was dropped during dispatch —
> blocks ship on the existing surfaces instead: `chart-line`
> (marketing), `data-viz-bars` / `data-viz-donut` / `metric-trend`
> (app). Registered ids differ from the sketch below (`line-chart` →
> `chart-line`, `bar-chart` → `data-viz-bars`, `donut-chart` →
> `data-viz-donut`); semantics unchanged.

**Files:**

- Modify: `apps/web/src/kit/blocks.ts` (`surface` union += `"shared"`; register 4 blocks)
- Create: `apps/web/src/kit/blocks/shared/{line-chart,bar-chart,donut-chart,metric-trend}.{tsx,module.css}` (8 files)
- Modify: `apps/web/src/kit/blocks.test.ts` (pin the four ids + shared-surface file rule coverage)
- Modify: `apps/web/app/kit-blocks/page.tsx` + possibly `kit-blocks.module.css` (dual-surface demo)
- Mirrors: `.ai/apps/web/src/kit/blocks.md`, `.ai/apps/web/src/kit/blocks.test.md`, `.ai/apps/web/src/kit/blocks/shared/*.md` (new, per file), `.ai/apps/web/app/kit-blocks/page.md`

**Context:** Blocks must be copyable, token-only, and dependency-free — pure SVG server components (NO `"use client"`): SSR output works no-JS and under every pack. Colors: default series color `var(--accent)`; additional categorical stops derived with `color-mix(in srgb, var(--accent) <n>%, var(--muted))` (or a `--chart-N` custom property defined in each block's css so products can retune); callers may pass explicit CSS colors per series/slice. Follow the data-visualization skill rules: bar values start at 0; donuts ≤6 slices with legend + percentages (never color-only encoding); every chart is `role="img"` with `aria-label` and a visually-hidden data table/list fallback (`.srOnly` in module css); gridlines hairline `var(--border)`; value formatting via optional `formatValue` prop.

- [x] **Step 1: Registry type + failing test**

`KitBlock.surface` becomes `"marketing" | "app" | "chrome" | "shared"`. In `blocks.test.ts` add a test asserting `line-chart`, `bar-chart`, `donut-chart`, `metric-trend` ids exist with `surface === "shared"` and files under `src/kit/blocks/shared/` (the existing generic rule covers the path check automatically). Run to RED.

- [x] **Step 2: Implement the four blocks**

`line-chart.tsx`:

```ts
export type LineChartPoint = { label: string; value: number };
export type LineChartSeries = { color?: string; name: string; points: readonly LineChartPoint[] };
export function LineChart(props: {
  area?: boolean; // fill under the (first) series
  formatValue?: (value: number) => string;
  height?: number; // px viewBox height, default 220
  series: readonly LineChartSeries[];
  title: string; // drives aria-label + visible caption
});
```

SVG `viewBox="0 0 640 220"` (scales, `width:100%`), y ticks at 0/25/50/75/100% of max (max snapped to a nice value), x labels every nth point to avoid collision, polyline per series, optional `fill` area path. `figure` wrapper: `figcaption` title + `<svg role="img" aria-label>` + sr-only `<table>` of the data.

`bar-chart.tsx`: horizontal bars (ranking-friendly), props `{ formatValue?, items: readonly { label: string; value: number }[], title }`; scale `value / max`, value labels at bar end, bars `var(--accent)` (per-item `color` override allowed).

`donut-chart.tsx`: `{ centerLabel?, items: readonly { color?; label: string; value: number }[], title }` — SVG circle slices via `stroke-dasharray` on a single radius; ≤6 slices (extra slices roll into "Other"); legend list with chip + label + percentage; center shows `centerLabel ?? total`.

`metric-trend.tsx`: `{ delta?: { direction: "up"|"down"|"flat"; label: string }; label: string; sparkline?: readonly number[]; value: string }` — KPI label, big value, delta chip (`▲`/`▼`/`–` + label; tone via classes, not color alone), optional inline SVG sparkline (`var(--accent)` stroke).

- [x] **Step 3: Showcase**

`kit-blocks/page.tsx`: extend the surface map to include `"shared"` — render a "Shared blocks — work on marketing and app surfaces" group; each shared block demos twice: once inside `.app-theme`, once inside `.marketing-theme` with `data-marketing-theme="inherit"` (the existing marketing cell wrapper). Realistic sample data (e.g. weekly active readers, report views by segment, plan mix donut, MRR metric-trend). If `kit-blocks.module.css` needs a two-up demo cell, add a minimal `.dual` grid.

- [x] **Step 4: Verify + mirrors + commit**

Run: `pnpm --filter @supastack/web test -- src/kit/blocks.test.ts` + web typecheck. Verify SSR-safety by inspection (no hooks/client directives). Update mirrors — `.ai/apps/web/src/kit/blocks.md` gets a "Shared surface" section noting the dual-surface rule + the four blocks. Commit only your files: `feat(kit): shared data-visualization blocks`.

---

### Task 5: Repo docs sweep (controller-owned)

- [x] `.ai/PROJECT_CONTEXT.md` — new Current Work entry describing all three features.
- [x] `AGENTS.md` — extend the "Block library" bullet with the `shared` surface (`line-chart`, `bar-chart`, `donut-chart`, `metric-trend`); the scheduler bullet may mention `email.digest` as the shipped workspace-job example.
- [x] `.ai/AGENTS.md` Change History row.
- [ ] `apps/web/AGENTS.md` — DO NOT touch (auto-generated by `next dev`).

**Post-repo step (handled by controller, outside this repo):** seller-site changelog entry + locale overlays + its own `.ai` bookkeeping + `pnpm vitest run` on the site-content tests.
