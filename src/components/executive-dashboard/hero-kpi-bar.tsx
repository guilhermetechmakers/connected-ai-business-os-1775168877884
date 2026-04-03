import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ExecutiveKpiTile } from "@/types/executive-dashboard";

export type HeroKPIBarProps = {
  kpis: ExecutiveKpiTile[];
  isLoading?: boolean;
  className?: string;
};

function TrendIcon({ trend }: { trend: ExecutiveKpiTile["trend"] }) {
  if (trend === "up") return <ArrowUpRight className="h-3.5 w-3.5 text-success" aria-hidden />;
  if (trend === "down") return <ArrowDownRight className="h-3.5 w-3.5 text-destructive" aria-hidden />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
}

export function HeroKPIBar({ kpis, isLoading, className }: HeroKPIBarProps) {
  const list = Array.isArray(kpis) ? kpis : [];

  if (isLoading) {
    return (
      <div
        className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}
        aria-busy="true"
        aria-label="Loading KPI tiles"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl border border-border/40" />
        ))}
      </div>
    );
  }

  return (
    <ul
      className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}
      aria-label="Executive KPI summary"
    >
      {list.slice(0, 6).map((k) => (
        <li
          key={k.id}
          className="rounded-xl border border-border/60 bg-surface-inner/60 p-4 transition-colors duration-150 hover:border-primary/25"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {k.name}
            </p>
            <span className="shrink-0" aria-hidden>
              <TrendIcon trend={k.trend} />
            </span>
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground md:text-3xl">
            {k.valueText}
            {k.unit ? (
              <span className="ml-1 text-sm font-medium text-muted-foreground">{k.unit}</span>
            ) : null}
          </p>
          {k.delta ? (
            <p className="mt-1 text-xs text-muted-foreground">{k.delta}</p>
          ) : (
            <p className="mt-1 text-xs text-transparent">—</p>
          )}
        </li>
      ))}
    </ul>
  );
}
