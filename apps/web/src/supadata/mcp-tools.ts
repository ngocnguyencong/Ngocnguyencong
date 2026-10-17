import "server-only";

import { defineTool, type ToolContext, type ToolDefinition } from "@supastack/agents";
import { sdAlert, sdFunnel, sdGoal, sdIntegration } from "@supastack/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { database } from "../auth-runtime";
import { listWorkspaceSites, siteForWorkspace, type SdSite } from "./auth";
import { recordPayment } from "./payments";
import {
  breakdown,
  funnelResults,
  goalStats,
  keywords,
  mentions,
  mrrSeries,
  overview,
  payments,
  realtime,
  resolveRange,
  revenueAttribution,
  revenueSummary,
  timeseries,
  visitorDetail,
  visitors,
} from "./queries";

const PERIODS = ["24h", "7d", "30d", "90d"] as const;
const DIMENSIONS = [
  "page",
  "referrer",
  "source",
  "channel",
  "medium",
  "campaign",
  "country",
  "region",
  "city",
  "device",
  "browser",
  "os",
  "hostname",
  "event",
  "goal",
] as const;

const siteInput = z
  .string()
  .optional()
  .describe("Site id (sdid_*). Omit to use the workspace's first site.");
const periodInput = z.enum(PERIODS).optional().describe("Reporting window. Defaults to 30d.");

class ToolUserError extends Error {}

async function resolveSite(context: ToolContext, siteRef: string | undefined): Promise<SdSite> {
  const site = siteRef
    ? await siteForWorkspace(context.workspaceId, siteRef)
    : ((await listWorkspaceSites(context.workspaceId))[0] ?? null);
  if (!site) {
    throw new ToolUserError(
      siteRef ? "Site not found in this workspace." : "This workspace has no analytics sites yet.",
    );
  }
  return site;
}

/**
 * Analytics (supadata) tools for the shared MCP/tool registry. Every call is
 * scoped by the injected ToolContext workspace — keys and sessions behave
 * exactly like the /api/v1 REST surface.
 */
export function createSupadataTools(): readonly ToolDefinition[] {
  return [
    defineTool({
      name: "list_sites",
      title: "List analytics sites",
      description: "List the analytics sites in the caller's workspace (id, name, domain).",
      scope: "read",
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        const sites = await listWorkspaceSites(context.workspaceId);
        return sites.map((s) => ({ id: s.id, name: s.name, domain: s.domain, shareId: s.shareId }));
      },
    }),
    defineTool({
      name: "analytics_overview",
      title: "Analytics overview",
      description:
        "Headline metrics for a site: visitors, pageviews, sessions, bounce rate, session duration, revenue, and conversion.",
      scope: "read",
      inputSchema: z.object({ site: siteInput, period: periodInput }),
      execute: async (input, context) =>
        overview((await resolveSite(context, input.site)).id, resolveRange(input.period ?? "30d")),
    }),
    defineTool({
      name: "analytics_timeseries",
      title: "Analytics timeseries",
      description: "Daily/hourly visitors, pageviews, sessions, and revenue buckets for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput, period: periodInput }),
      execute: async (input, context) =>
        timeseries(
          (await resolveSite(context, input.site)).id,
          resolveRange(input.period ?? "30d"),
        ),
    }),
    defineTool({
      name: "analytics_breakdown",
      title: "Analytics breakdown",
      description:
        "Top values for a dimension (page, source, channel, campaign, country, device, browser, os, event, goal, …) with visitors, views, and attributed revenue.",
      scope: "read",
      inputSchema: z.object({
        site: siteInput,
        dimension: z.enum(DIMENSIONS),
        period: periodInput,
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input, context) =>
        breakdown(
          (await resolveSite(context, input.site)).id,
          resolveRange(input.period ?? "30d"),
          input.dimension,
          input.limit ?? 20,
        ),
    }),
    defineTool({
      name: "analytics_realtime",
      title: "Realtime visitors",
      description: "Visitors active on the site in the last five minutes.",
      scope: "read",
      inputSchema: z.object({ site: siteInput }),
      execute: async (input, context) => realtime((await resolveSite(context, input.site)).id),
    }),
    defineTool({
      name: "analytics_insights",
      title: "Revenue insights",
      description:
        "Revenue summary, channel/source/campaign attribution, MRR series, and goal stats for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput, period: periodInput }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        const r = resolveRange(input.period ?? "30d");
        const [revenue, byChannel, bySource, mrr, goals] = await Promise.all([
          revenueSummary(site.id, r),
          revenueAttribution(site.id, r, "channel"),
          revenueAttribution(site.id, r, "source"),
          mrrSeries(site.id, r),
          goalStats(site.id, r),
        ]);
        return { revenue, byChannel, bySource, mrr, goals };
      },
    }),
    defineTool({
      name: "list_visitors",
      title: "List visitors",
      description: "Recent visitors for a site with geo, device, revenue, and last-seen data.",
      scope: "read",
      inputSchema: z.object({
        site: siteInput,
        period: periodInput,
        search: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input, context) =>
        visitors((await resolveSite(context, input.site)).id, resolveRange(input.period ?? "30d"), {
          search: input.search,
          limit: input.limit ?? 25,
        }),
    }),
    defineTool({
      name: "get_visitor",
      title: "Get visitor",
      description: "A visitor's profile, event journey, and payments.",
      scope: "read",
      inputSchema: z.object({
        site: siteInput,
        visitorId: z.string().min(1),
      }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        const detail = await visitorDetail(site.id, input.visitorId);
        if (!detail) throw new ToolUserError("Visitor not found.");
        return detail;
      },
    }),
    defineTool({
      name: "list_payments",
      title: "List payments",
      description: "Recent payments and refunds with attribution fields.",
      scope: "read",
      inputSchema: z.object({
        site: siteInput,
        period: periodInput,
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input, context) =>
        payments(
          (await resolveSite(context, input.site)).id,
          resolveRange(input.period ?? "30d"),
          input.limit ?? 25,
        ),
    }),
    defineTool({
      name: "record_payment",
      title: "Record payment",
      description:
        "Record a payment or refund and attribute it to a visitor via visitorRef, userId, or email.",
      scope: "write",
      inputSchema: z.object({
        site: siteInput,
        amountCents: z.number().int(),
        currency: z.string().length(3).optional(),
        email: z.string().email().optional(),
        visitorRef: z.string().optional(),
        userId: z.string().optional(),
        externalId: z.string().max(200).optional(),
        provider: z.string().max(40).optional(),
        kind: z.enum(["payment", "refund"]).optional(),
        productName: z.string().max(200).optional(),
      }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        const result = await recordPayment(site.id, {
          amountCents: input.amountCents,
          provider: input.provider ?? "mcp",
          email: input.email ?? null,
          visitorRef: input.visitorRef ?? null,
          userId: input.userId ?? null,
          externalId: input.externalId ?? null,
          productName: input.productName ?? null,
          ...(input.currency ? { currency: input.currency } : {}),
          ...(input.kind ? { kind: input.kind } : {}),
        });
        if (!result) throw new ToolUserError("Payment could not be recorded.");
        return result;
      },
    }),
    defineTool({
      name: "list_goals",
      title: "List goals",
      description: "Configured goals and their conversion stats for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput, period: periodInput }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        const [defs, stats] = await Promise.all([
          database.select().from(sdGoal).where(eq(sdGoal.siteId, site.id)),
          goalStats(site.id, resolveRange(input.period ?? "30d")),
        ]);
        return { goals: defs, stats };
      },
    }),
    defineTool({
      name: "funnel_results",
      title: "Funnel results",
      description: "Step-by-step conversion for an ordered funnel definition.",
      scope: "read",
      inputSchema: z.object({
        site: siteInput,
        period: periodInput,
        steps: z
          .array(
            z.object({
              type: z.enum(["pageview", "event"]),
              value: z.string().min(1).max(512),
            }),
          )
          .min(1)
          .max(8),
      }),
      execute: async (input, context) =>
        funnelResults(
          (await resolveSite(context, input.site)).id,
          resolveRange(input.period ?? "30d"),
          input.steps,
        ),
    }),
    defineTool({
      name: "list_funnels",
      title: "List funnels",
      description: "Saved funnel definitions for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        return database.select().from(sdFunnel).where(eq(sdFunnel.siteId, site.id));
      },
    }),
    defineTool({
      name: "list_alerts",
      title: "List alerts",
      description: "Configured metric alerts for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        return database.select().from(sdAlert).where(eq(sdAlert.siteId, site.id));
      },
    }),
    defineTool({
      name: "list_mentions",
      title: "List mentions",
      description: "Recent social/web mentions for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput, period: periodInput }),
      execute: async (input, context) =>
        mentions((await resolveSite(context, input.site)).id, resolveRange(input.period ?? "30d")),
    }),
    defineTool({
      name: "list_keywords",
      title: "List keywords",
      description: "Search keyword rows (clicks, impressions, position) for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput, period: periodInput }),
      execute: async (input, context) =>
        keywords((await resolveSite(context, input.site)).id, resolveRange(input.period ?? "30d")),
    }),
    defineTool({
      name: "list_integrations",
      title: "List integrations",
      description: "Connected provider integrations for a site.",
      scope: "read",
      inputSchema: z.object({ site: siteInput }),
      execute: async (input, context) => {
        const site = await resolveSite(context, input.site);
        return database.select().from(sdIntegration).where(eq(sdIntegration.siteId, site.id));
      },
    }),
  ];
}
