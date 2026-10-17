import { DashboardFrame } from "../../../src/supadata/web/frame";
import { LiveView } from "../../../src/supadata/web/live-view";
import { realtime } from "../../../src/supadata/queries";

export const dynamic = "force-dynamic";

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <DashboardFrame siteParam={sp.site ?? null}>
      {async (ctx) => {
        if (!ctx.site) return <p>No site selected.</p>;
        const initial = await realtime(ctx.site.id);
        return <LiveView initial={initial} siteId={ctx.site.id} />;
      }}
    </DashboardFrame>
  );
}
