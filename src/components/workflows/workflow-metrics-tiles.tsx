import { AlertTriangle, CheckCircle2, Clock, Workflow } from "lucide-react";
import { useMemo } from "react";

import type { WorkflowRunRow } from "@/types/workflows";
import { cn } from "@/lib/utils";

export type WorkflowMetricsTilesProps = {
  runs: WorkflowRunRow[];
  className?: string;
};

export function WorkflowMetricsTiles({ runs, className }: WorkflowMetricsTilesProps) {
  const list = Array.isArray(runs) ? runs : [];
  const stats = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let running = 0;
    for (const r of list) {
      const s = String(r.status ?? "");
      if (s === "Completed") completed += 1;
      else if (s === "Failed") failed += 1;
      else if (s === "Running") running += 1;
    }
    const denom = list.length || 1;
    const successRate = Math.round((completed / denom) * 100);
    return { total: list.length, completed, failed, running, successRate };
  }, [list]);

  const tiles = [
    {
      label: "Total runs (sample)",
      value: String(stats.total),
      icon: Workflow,
      className: "border-border/70",
    },
    {
      label: "Success rate",
      value: `${stats.successRate}%`,
      icon: CheckCircle2,
      className: "border-success/25 text-success",
    },
    {
      label: "Failed",
      value: String(stats.failed),
      icon: AlertTriangle,
      className: "border-destructive/25 text-destructive",
    },
    {
      label: "In flight",
      value: String(stats.running),
      icon: Clock,
      className: "border-primary/30 text-primary",
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {(tiles ?? []).map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.label}
            className={cn(
              "rounded-xl border bg-card/90 p-4 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover",
              t.className,
            )}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                {t.label}
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-foreground">
              {t.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
