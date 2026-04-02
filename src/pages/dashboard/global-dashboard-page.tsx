import { useMemo, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { edgeApi } from "@/api/edge";
import { AnimatedPage } from "@/components/animated-page";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityStream } from "@/components/unified-data/activity-stream";
import { AlertPanel } from "@/components/unified-data/alert-panel";
import { KPIBlock } from "@/components/unified-data/kpi-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import {
  useDashboardRollups,
  useRecentActivityFeed,
  useUnifiedEntitiesList,
} from "@/hooks/use-unified-data";
import type { DashboardEntityRollup, DashboardKpiSnapshot } from "@/types/unified";
import { mapActivityLogsToFeed, mapUnifiedEntityRows } from "@/types/unified";
import { toast } from "sonner";

const trend = [
  { name: "Mon", value: 32 },
  { name: "Tue", value: 40 },
  { name: "Wed", value: 38 },
  { name: "Thu", value: 52 },
  { name: "Fri", value: 61 },
  { name: "Sat", value: 48 },
  { name: "Sun", value: 55 },
];

const fallbackKpis = [
  { label: "Active workflows", value: "128", delta: "+12%", trend: "up" as const },
  { label: "Integration health", value: "98.4%", delta: "+0.6%", trend: "up" as const },
  { label: "AI actions / day", value: "1.4k", delta: "+8%", trend: "up" as const },
  { label: "Open approvals", value: "7", delta: "-3", trend: "down" as const },
];

function isKpiSnapshot(
  row: DashboardEntityRollup | DashboardKpiSnapshot,
): row is DashboardKpiSnapshot {
  return "last_activity_at" in row && row.last_activity_at !== undefined;
}

export default function GlobalDashboardPage() {
  const { profile } = useAuth();
  const roles = Array.isArray(profile?.roles) ? profile!.roles : [];
  const roleLabel = roles.length > 0 ? roles.join(", ") : "Member";

  const { data: rollupsRaw = [], isLoading: rollupsLoading } =
    useDashboardRollups("rollups");
  const rollups = Array.isArray(rollupsRaw) ? rollupsRaw : [];

  const { data: activityLogs = [], isLoading: actLoading } = useRecentActivityFeed(24);
  const { data: alertRows = [], isLoading: alertLoading } = useUnifiedEntitiesList({
    entityType: "Alert",
    limit: 12,
  });

  const activityFeed = useMemo(
    () => mapActivityLogsToFeed(activityLogs),
    [activityLogs],
  );
  const alerts = useMemo(() => mapUnifiedEntityRows(alertRows), [alertRows]);

  const [insightLoading, setInsightLoading] = useState(false);
  const [insightText, setInsightText] = useState<string | null>(null);

  const rollupKpis = useMemo(() => {
    if (rollups.length === 0) return null;
    return rollups.slice(0, 4).map((r) => {
      const extra = isKpiSnapshot(r) ? r.last_activity_at : null;
      return {
        label: r.entity_type,
        value: String(r.active_count ?? 0),
        delta: extra ? new Date(extra).toLocaleDateString() : undefined,
        trend: "neutral" as const,
      };
    });
  }, [rollups]);

  const kpiBlocks = rollupKpis ?? fallbackKpis;

  async function runInsightStrip() {
    setInsightLoading(true);
    try {
      const summaryRollups = JSON.stringify(rollups ?? []).slice(0, 4000);
      const data = await edgeApi.invoke<{
        choices?: { message?: { content?: string } }[];
      }>("llm-proxy", {
        messages: [
          {
            role: "system",
            content:
              "You summarize tenant dashboard rollups. Output 3 concise bullets. Do not invent numbers.",
          },
          {
            role: "user",
            content: `Rollups JSON (truncated): ${summaryRollups}`,
          },
        ],
      });
      const text = data?.choices?.[0]?.message?.content ?? "";
      setInsightText(text || "No insight returned.");
      toast.success("Insight refreshed");
    } catch {
      toast.error("Could not refresh insight");
    } finally {
      setInsightLoading(false);
    }
  }

  return (
    <AnimatedPage className="space-y-10">
      <PageHeader
        title="Global dashboard"
        description="Aggregated KPIs, alerts, and quick actions across connected systems — scoped to your tenant and role."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/reports">Export report</Link>
            </Button>
            <Button variant="cta" asChild>
              <Link to="/dashboard/ai">
                <Sparkles className="h-4 w-4" />
                Ask AI
              </Link>
            </Button>
          </>
        }
      />

      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Tailored for <span className="text-primary">{roleLabel}</span> · unified data
        layer
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {rollupsLoading && !rollupKpis
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : kpiBlocks.map((k) => (
              <KPIBlock
                key={k.label}
                label={k.label}
                value={k.value}
                delta={k.delta}
                trend={"trend" in k ? k.trend : "neutral"}
              />
            ))}
      </div>

      <Card className="border-border/80 bg-gradient-to-r from-primary/10 via-transparent to-success/5 shadow-card">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">AI-assisted insight strip</CardTitle>
            <p className="text-sm text-muted-foreground">
              Summaries use the LLM proxy with tenant rollups you already loaded.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={insightLoading}
            onClick={() => void runInsightStrip()}
            className="gap-2 transition-transform duration-150 hover:scale-[1.02]"
            aria-label="Refresh AI insights"
          >
            <Sparkles className="h-4 w-4" />
            {insightLoading ? "Working…" : "Refresh insight"}
          </Button>
        </CardHeader>
        <CardContent>
          {insightText ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{insightText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tap refresh to summarize current rollups. Requires OpenAI key on the
              llm-proxy function when enabled.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/80 bg-card/90 shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cross-system throughput</CardTitle>
              <p className="text-sm text-muted-foreground">
                Trend sample; wire to materialized KPI series from unified ingest.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/activity">
                Activity
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(154,208,255)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="rgb(154,208,255)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="rgb(143,160,176)" tickLine={false} />
                <YAxis stroke="rgb(143,160,176)" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgb(15,23,32)",
                    border: "1px solid rgb(17,32,43)",
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="rgb(154,208,255)"
                  fill="url(#fill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-card">
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(roles.some((r) => /admin|manager/i.test(r))
              ? [
                  { label: "Run integration sync", to: "/onboarding/integrations" },
                  { label: "Create workflow", to: "/dashboard/workflows" },
                  { label: "Install module", to: "/dashboard/modules" },
                ]
              : [
                  { label: "Open search", to: "/search" },
                  { label: "Department workspaces", to: "/dashboard/departments" },
                  { label: "Notifications", to: "/dashboard/notifications" },
                ]
            ).map((a) => (
              <Button
                key={a.label}
                variant="outline"
                className="w-full justify-between transition-transform duration-150 hover:scale-[1.01]"
                asChild
              >
                <Link to={a.to}>
                  {a.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActivityStream items={activityFeed} isLoading={actLoading} />
        <AlertPanel alerts={alerts} isLoading={alertLoading} />
      </div>
    </AnimatedPage>
  );
}
