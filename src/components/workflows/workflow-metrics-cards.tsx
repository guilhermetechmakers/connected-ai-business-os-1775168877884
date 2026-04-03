import { AlertTriangle, Clock, Gauge, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkflowRunRow } from "@/types/workflows";

export type WorkflowMetricsCardsProps = {
  runs: WorkflowRunRow[];
  className?: string;
};

function parseDurationMs(run: WorkflowRunRow): number | null {
  const meta = run.result_metadata;
  if (meta && typeof meta === "object" && "durationMs" in meta) {
    const v = (meta as { durationMs?: unknown }).durationMs;
    if (typeof v === "number" && v >= 0) return v;
  }
  const start = run.started_at ? Date.parse(run.started_at) : NaN;
  const end = run.finished_at ? Date.parse(run.finished_at) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return end - start;
}

export function WorkflowMetricsCards({
  runs,
  className,
}: WorkflowMetricsCardsProps) {
  const list = Array.isArray(runs) ? runs : [];
  const total = list.length;
  const completed = list.filter((r) => r.status === "Completed").length;
  const failed = list.filter(
    (r) => r.status === "Failed" || r.status === "Canceled",
  ).length;
  const running = list.filter((r) => r.status === "Running").length;
  const successRate =
    total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;

  const durations = list
    .map(parseDurationMs)
    .filter((x): x is number => x !== null);
  const avgMs =
    durations.length > 0
      ? Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length,
        )
      : null;

  const cards = [
    {
      label: "Total runs",
      value: String(total),
      sub: running > 0 ? `${running} active` : "Last fetched batch",
      icon: Gauge,
      accent: "text-primary",
    },
    {
      label: "Success rate",
      value: `${successRate}%`,
      sub: `${completed} completed`,
      icon: TrendingUp,
      accent: "text-success",
    },
    {
      label: "Failures / stops",
      value: String(failed),
      sub: "Failed + canceled",
      icon: AlertTriangle,
      accent: failed > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Avg duration",
      value: avgMs !== null ? `${(avgMs / 1000).toFixed(1)}s` : "—",
      sub: "From timestamps / metadata",
      icon: Clock,
      accent: "text-primary",
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {c.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
              </div>
              <Icon className={cn("h-5 w-5 shrink-0", c.accent)} aria-hidden />
            </div>
          </div>
        );
      })}
    </div>
  );
}
