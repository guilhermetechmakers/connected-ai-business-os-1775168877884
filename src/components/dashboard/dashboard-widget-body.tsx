import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, Bot, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { GlobalSearchBar } from "@/components/global-search/global-search-bar";
import { ActivityStream } from "@/components/unified-data/activity-stream";
import { AlertPanel } from "@/components/unified-data/alert-panel";
import { KPIBlock } from "@/components/unified-data/kpi-block";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardWidgetData } from "@/hooks/use-dashboard-widget-data";
import { completeAiChat, fetchExecutiveBrief } from "@/lib/ai-api";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { DashboardWidgetDefinitionRow } from "@/types/dashboard";
import type { DataAdapterContext } from "@/types/dashboard";
import type { DashboardEntityRollup, DashboardKpiSnapshot } from "@/types/unified";
import { mapActivityLogsToFeed, mapUnifiedEntityRows } from "@/types/unified";
import type { Json } from "@/types/database";

export type DashboardWidgetBodyProps = {
  widgetType: string;
  definition?: DashboardWidgetDefinitionRow;
  dataContext: DataAdapterContext;
  dashSearch: string;
  onDashSearchChange: (v: string) => void;
};

function isKpiSnapshot(
  row: DashboardEntityRollup | DashboardKpiSnapshot,
): row is DashboardKpiSnapshot {
  return "last_activity_at" in row && row.last_activity_at !== undefined;
}

function readPayloadName(payload: Json, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const p = payload as Record<string, unknown>;
  const n = p.name ?? p.title ?? p.label;
  return typeof n === "string" && n.trim() ? n : fallback;
}

function readHealthScore(payload: Json): number {
  if (!payload || typeof payload !== "object") return 72;
  const p = payload as Record<string, unknown>;
  const s = p.healthScore ?? p.score ?? p.health;
  return typeof s === "number" && !Number.isNaN(s) ? Math.min(100, Math.max(0, s)) : 72;
}

export function DashboardWidgetBody({
  widgetType,
  definition,
  dataContext,
  dashSearch,
  onDashSearchChange,
}: DashboardWidgetBodyProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  const defConfig =
    definition?.default_config && typeof definition.default_config === "object"
      ? (definition.default_config as Record<string, unknown>)
      : {};

  const rollupsQ = useDashboardWidgetData(
    widgetType === "kpi_strip" || widgetType === "ai_insight" ? "rollups" : null,
    {},
    dataContext,
    widgetType === "kpi_strip" || widgetType === "ai_insight",
  );
  const activityQ = useDashboardWidgetData(
    widgetType === "activity_stream" ? "activity_feed" : null,
    defConfig,
    dataContext,
    widgetType === "activity_stream",
  );
  const alertsQ = useDashboardWidgetData(
    widgetType === "alerts_feed" ? "alerts_feed" : null,
    defConfig,
    dataContext,
    widgetType === "alerts_feed",
  );
  const chartQ = useDashboardWidgetData(
    widgetType === "throughput_chart" ? "throughput_sample" : null,
    {},
    dataContext,
    widgetType === "throughput_chart",
  );
  const riskQ = useDashboardWidgetData(
    widgetType === "risk_pie" ? "risk_sample" : null,
    {},
    dataContext,
    widgetType === "risk_pie",
  );
  const metricsQ = useDashboardWidgetData(
    widgetType === "exec_metrics" ? "exec_metrics" : null,
    {},
    dataContext,
    widgetType === "exec_metrics",
  );
  const deptQ = useDashboardWidgetData(
    widgetType === "dept_heatmap" ? "departments_rollup" : null,
    {},
    dataContext,
    widgetType === "dept_heatmap",
  );
  const aiGovQ = useDashboardWidgetData(
    widgetType === "ai_governance" ? "ai_governance" : null,
    {},
    dataContext,
    widgetType === "ai_governance",
  );

  const [insightLoading, setInsightLoading] = useState(false);
  const [insightText, setInsightText] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("7d");

  const briefMutation = useMutation({
    mutationFn: () => fetchExecutiveBrief({ timeframe }),
    onError: () => toast.error("Could not generate executive brief"),
    onSuccess: () => toast.success("Executive brief updated"),
  });

  const rollupsRaw = rollupsQ.data;
  const rollups = Array.isArray(rollupsRaw) ? rollupsRaw : [];

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

  const fallbackKpis = [
    { label: "Active workflows", value: "128", delta: "+12%", trend: "up" as const },
    { label: "Integration health", value: "98.4%", delta: "+0.6%", trend: "up" as const },
    { label: "AI actions / day", value: "1.4k", delta: "+8%", trend: "up" as const },
    { label: "Open approvals", value: "7", delta: "-3", trend: "down" as const },
  ];

  const kpiBlocks = rollupKpis ?? fallbackKpis;

  const activityLogs = Array.isArray(activityQ.data) ? activityQ.data : [];
  const activityFeed = useMemo(
    () => mapActivityLogsToFeed(activityLogs),
    [activityLogs],
  );

  const alertRows = Array.isArray(alertsQ.data) ? alertsQ.data : [];
  const alerts = useMemo(() => mapUnifiedEntityRows(alertRows), [alertRows]);

  const trendData = Array.isArray(chartQ.data) ? chartQ.data : [];
  const riskData = Array.isArray(riskQ.data) ? riskQ.data : [];
  const execMetrics = Array.isArray(metricsQ.data) ? metricsQ.data : [];

  const deptRows = Array.isArray(deptQ.data) ? deptQ.data : [];
  const heat = useMemo(() => {
    if (deptRows.length === 0) {
      return [
        { dept: "Revenue", score: 88 },
        { dept: "Product", score: 72 },
        { dept: "Operations", score: 64 },
        { dept: "Finance", score: 91 },
      ];
    }
    return deptRows.slice(0, 8).map((row, i) => ({
      dept: readPayloadName(row.payload, `Department ${i + 1}`),
      score: readHealthScore(row.payload),
    }));
  }, [deptRows]);

  const aiGov = aiGovQ.data as
    | {
        tokenTotals7d?: { prompt?: number; completion?: number; samples?: number };
        recentActions?: { id: string; action_name: string; status: string }[];
        recentPermissionDenials?: { id: string; action_name: string }[];
      }
    | null
    | undefined;

  const aiRecentActions = Array.isArray(aiGov?.recentActions) ? aiGov!.recentActions : [];
  const aiDenials = Array.isArray(aiGov?.recentPermissionDenials)
    ? aiGov!.recentPermissionDenials
    : [];

  async function runInsightStrip() {
    if (!isSupabaseConfigured) {
      toast.error("Configure Supabase to run AI insights.");
      return;
    }
    setInsightLoading(true);
    try {
      const summaryRollups = JSON.stringify(rollups ?? []).slice(0, 4000);
      const out = await completeAiChat({
        messages: [
          {
            role: "user",
            content: `Summarize these dashboard rollups in exactly 3 concise bullets. Do not invent numbers. JSON: ${summaryRollups}`,
          },
        ],
        mode: "Analyze",
        workspaceId: "global",
      });
      setInsightText(out.message?.trim() || "No insight returned.");
    } catch {
      toast.error("Could not refresh insight");
    } finally {
      setInsightLoading(false);
    }
  }

  switch (widgetType) {
    case "global_search_card":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Autosuggest, filters, and AI summaries — continue in the full search workspace.
          </p>
          <GlobalSearchBar
            value={dashSearch}
            onChange={onDashSearchChange}
            onSubmit={() => {
              const t = dashSearch.trim();
              navigate(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
            }}
            variant="hero"
            aria-label="Dashboard global search"
          />
        </div>
      );
    case "kpi_strip":
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rollupsQ.isLoading && !rollupKpis
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
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
      );
    case "ai_insight":
      return (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={insightLoading}
              onClick={() => void runInsightStrip()}
              className="gap-2 transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
              aria-label="Refresh AI insights"
            >
              <Sparkles className="h-4 w-4" />
              {insightLoading ? "Working…" : "Refresh insight"}
            </Button>
          </div>
          {insightText ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{insightText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tap refresh to summarize current rollups. Requires deployed{" "}
              <code className="text-primary">ai-api</code>.
            </p>
          )}
        </div>
      );
    case "ai_governance":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {aiGovQ.isLoading ? (
            <>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </>
          ) : (
            <>
              <div className="rounded-xl border border-border/60 bg-surface-inner/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Tokens (7 days)
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
                  {(aiGov?.tokenTotals7d?.prompt ?? 0) + (aiGov?.tokenTotals7d?.completion ?? 0)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">total</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Prompt {aiGov?.tokenTotals7d?.prompt ?? 0} · Completion{" "}
                  {aiGov?.tokenTotals7d?.completion ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-inner/80 p-4 transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Recent AI actions
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {aiRecentActions.length === 0 ? (
                    <li className="text-muted-foreground">No logged actions yet.</li>
                  ) : (
                    aiRecentActions.slice(0, 5).map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-2 border-b border-border/30 pb-2 last:border-0"
                      >
                        <span className="truncate font-mono text-xs text-primary">{a.action_name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{a.status}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          )}
          <div className="md:col-span-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden />
              Permission denials
            </p>
            {aiDenials.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No recent denials.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {aiDenials.map((d) => (
                  <li key={d.id} className="font-mono text-xs text-destructive/90">
                    {d.action_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="cta" size="sm" className="gap-2" asChild>
              <Link to="/dashboard/ai">
                <Bot className="h-4 w-4" />
                Open AI workspace
              </Link>
            </Button>
          </div>
        </div>
      );
    case "throughput_chart": {
      const data =
        trendData.length > 0
          ? trendData
          : [
              { name: "Mon", value: 32 },
              { name: "Tue", value: 40 },
            ];
      return (
        <div className="h-64 min-h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#dashFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "quick_actions": {
      const actions = roles.some((r) => /admin|manager/i.test(r))
        ? [
            { label: "Global search", to: "/search" },
            { label: "Run integration sync", to: "/onboarding/integrations" },
            { label: "Create workflow", to: "/dashboard/workflows" },
            { label: "Install module", to: "/dashboard/modules" },
          ]
        : [
            { label: "Open search", to: "/search" },
            { label: "Department workspaces", to: "/dashboard/departments" },
            { label: "Notifications", to: "/dashboard/notifications" },
          ];
      return (
        <div className="flex flex-col gap-2">
          {(actions ?? []).map((a) => (
            <Button
              key={a.label}
              variant="outline"
              className="w-full justify-between transition-transform duration-150 hover:scale-[1.01] motion-reduce:hover:scale-100"
              asChild
            >
              <Link to={a.to}>
                {a.label}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          ))}
        </div>
      );
    }
    case "activity_stream":
      return <ActivityStream items={activityFeed} isLoading={activityQ.isLoading} />;
    case "alerts_feed":
      return <AlertPanel alerts={alerts} isLoading={alertsQ.isLoading} />;
    case "risk_pie": {
      const data =
        riskData.length > 0
          ? riskData
          : [
              { name: "On track", value: 62, color: "rgb(0,210,122)" },
              { name: "Watch", value: 24, color: "rgb(154,208,255)" },
            ];
      return (
        <div className="h-64 min-h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
              >
                {data.map((entry: { name: string; color?: string }) => (
                  <Cell key={entry.name} fill={entry.color ?? "rgb(154,208,255)"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "rgb(15,23,32)",
                  border: "1px solid rgb(17,32,43)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case "exec_metrics":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {(execMetrics.length > 0
            ? execMetrics
            : [
                { label: "Net retention", value: "112%", delta: "+3%", trend: "up" },
                { label: "Pipeline", value: "3.4x", delta: "+0.2x", trend: "up" },
              ]
          ).map(
            (m: {
              label: string;
              value: string;
              delta?: string;
              trend?: "up" | "down" | "neutral";
            }) => (
              <KPIBlock
                key={m.label}
                label={m.label}
                value={m.value}
                delta={m.delta}
                trend={m.trend ?? "neutral"}
              />
            ),
          )}
        </div>
      );
    case "dept_heatmap":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {(heat ?? []).map((h) => (
            <div key={h.dept} className="space-y-2 rounded-lg bg-surface-inner p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{h.dept}</span>
                <span className="text-primary">{h.score}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all duration-300"
                  style={{ width: `${h.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      );
    case "exec_ai_brief": {
      const result = briefMutation.data;
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={timeframe}
              onValueChange={(v) => setTimeframe(v as "7d" | "30d" | "90d")}
            >
              <SelectTrigger className="w-[140px]" aria-label="Brief timeframe">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="cta"
              size="sm"
              disabled={briefMutation.isPending || !isSupabaseConfigured}
              onClick={() => briefMutation.mutate()}
              className="gap-2 transition-transform duration-150 hover:scale-[1.02] motion-reduce:hover:scale-100"
            >
              <Sparkles className="h-4 w-4" />
              {briefMutation.isPending ? "Generating…" : "Generate brief"}
            </Button>
          </div>
          {briefMutation.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          ) : result ? (
            <div className="prose prose-invert max-w-none text-sm prose-p:text-muted-foreground">
              <p className="whitespace-pre-wrap leading-relaxed">{result.brief}</p>
              {result.actionItems.length > 0 ? (
                <ul className="mt-2">
                  {result.actionItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {result.citations.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sources:{" "}
                  {result.citations
                    .map((c) => c.reference ?? c.source)
                    .filter(Boolean)
                    .slice(0, 6)
                    .join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a timeframe and generate a tenant-grounded executive brief (RAG + rollups). Requires{" "}
              <code className="text-primary">OPENAI_API_KEY</code> on <code className="text-primary">ai-api</code>.
            </p>
          )}
        </div>
      );
    }
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unknown widget type <code className="text-primary">{widgetType}</code>
        </p>
      );
  }
}
