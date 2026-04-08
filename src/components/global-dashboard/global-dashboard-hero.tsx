import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDashboardRollups } from "@/api/unified-data";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { DashboardDateRange } from "@/types/dashboard";
import type { DashboardEntityRollup, DashboardKpiSnapshot } from "@/types/unified";

import { TrendChart, type TrendChartDatum } from "@/components/global-dashboard/trend-chart";

export type GlobalDashboardHeroProps = {
  tenantName: string | null;
  dateRange: DashboardDateRange;
  className?: string;
};

function isKpiSnapshot(
  row: DashboardEntityRollup | DashboardKpiSnapshot,
): row is DashboardKpiSnapshot {
  return "last_activity_at" in row && row.last_activity_at !== undefined;
}

export function GlobalDashboardHero({ tenantName, dateRange, className }: GlobalDashboardHeroProps) {
  const rollupsQ = useQuery({
    queryKey: ["global-dashboard-hero-rollups", dateRange.fromIso, dateRange.toIso],
    queryFn: () => fetchDashboardRollups("rollups"),
    staleTime: 20_000,
    enabled: isSupabaseConfigured,
  });

  const rollupsRaw = rollupsQ.data;
  const rollups = Array.isArray(rollupsRaw) ? rollupsRaw : [];

  const headlineMetric = rollups[0];
  const metricLabel =
    headlineMetric && "entity_type" in headlineMetric
      ? String(headlineMetric.entity_type)
      : "Active entities";
  const metricValue =
    headlineMetric && typeof headlineMetric.active_count === "number"
      ? String(headlineMetric.active_count)
      : "—";

  const trendPoints: TrendChartDatum[] = rollups.slice(0, 7).map((r, i) => ({
    name: "entity_type" in r ? String(r.entity_type).slice(0, 3) : `P${i + 1}`,
    value: typeof r.active_count === "number" ? r.active_count : i * 8 + 12,
  }));

  const secondary =
    rollups[1] && "entity_type" in rollups[1]
      ? `${rollups[1].entity_type}: ${rollups[1].active_count ?? 0}`
      : "Cross-system throughput steady";

  return (
    <section
      className={cn(
        "grid gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-12",
        className,
      )}
      aria-labelledby="global-dashboard-hero-heading"
    >
      <div className="space-y-6 lg:col-span-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Global dashboard · {dateRange.preset.toUpperCase()} window
        </p>
        <h1
          id="global-dashboard-hero-heading"
          className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl"
        >
          Operational{" "}
          <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            clarity
          </span>{" "}
          for {tenantName ? <span className="text-primary">{tenantName}</span> : "your tenant"}.
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          KPIs, alerts, activity, and AI insights stay scoped to your company. Adjust the role preview
          and date range to validate visibility before sharing dashboards with stakeholders.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="cta"
            size="lg"
            className="rounded-full transition-transform duration-150 hover:scale-[1.03] motion-reduce:hover:scale-100"
            asChild
          >
            <Link to="/chat">
              <Sparkles className="h-4 w-4" aria-hidden />
              Open AI chat
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="rounded-full" asChild>
            <Link to="/search">Global search</Link>
          </Button>
        </div>
      </div>

      <div className="lg:col-span-5">
        <Card className="h-full border-border/80 bg-card/95 shadow-card transition-all duration-150 hover:-translate-y-1 hover:shadow-card-hover motion-reduce:hover:translate-y-0">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Live signal
              </p>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-live rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
            </div>
            {rollupsQ.isLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">{metricLabel}</p>
                <p className="font-display text-4xl font-bold tabular-nums text-foreground md:text-5xl">
                  {metricValue}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {headlineMetric && isKpiSnapshot(headlineMetric) && headlineMetric.last_activity_at
                    ? `Updated ${new Date(headlineMetric.last_activity_at).toLocaleString()}`
                    : secondary}
                </p>
              </div>
            )}
            <TrendChart
              data={trendPoints}
              aria-label="Entity activity trend preview"
              className="rounded-xl border border-border/50 bg-surface-inner/50 p-2"
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
