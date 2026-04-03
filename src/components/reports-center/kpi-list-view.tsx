import { RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { readJsonRecord } from "@/lib/reports-center-safe";
import type { KpiMetricRow } from "@/types/reports-center";

export interface KpiListViewProps {
  kpis: unknown;
  isLoading: boolean;
  canWrite: boolean;
  onRefresh: (id: string) => void;
  onCreateClick?: () => void;
  refreshingId: string | null;
  className?: string;
}

export function KpiListView({
  kpis,
  isLoading,
  canWrite,
  onRefresh,
  onCreateClick,
  refreshingId,
  className,
}: KpiListViewProps) {
  const list = Array.isArray(kpis) ? (kpis as KpiMetricRow[]) : [];

  if (isLoading) {
    return (
      <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <Card
        className={cn(
          "border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90",
          className,
        )}
      >
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Sparkles className="h-8 w-8 text-[rgb(154,208,255)]" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">
            No KPI definitions yet. Create metrics to drive report visuals and
            scheduled refreshes.
          </p>
          {canWrite && onCreateClick ? (
            <Button type="button" variant="cta" size="sm" onClick={onCreateClick}>
              New KPI
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {list.map((k) => {
        const cached = readJsonRecord(k.cached_value);
        const val =
          typeof cached.value === "number"
            ? String(cached.value)
            : cached.value != null
              ? JSON.stringify(cached.value)
              : "—";
        const computedAt =
          typeof cached.computedAt === "string" ? cached.computedAt : null;
        return (
          <Card
            key={k.id}
            className="group border-[rgb(21,78,120)]/40 bg-[rgb(15,23,32)]/90 transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgb(154,208,255)]/30 hover:shadow-lg hover:shadow-[rgb(0,210,122)]/10"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold text-[rgb(247,250,255)]">
                  {k.name}
                </CardTitle>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgb(0,210,122)] opacity-40 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[rgb(0,210,122)]" />
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-2xl font-semibold tabular-nums text-[rgb(154,208,255)]">
                {val}
              </p>
              {computedAt ? (
                <p className="text-xs text-muted-foreground">
                  Computed {new Date(computedAt).toLocaleString()}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Not computed yet</p>
              )}
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full transition-transform duration-150 hover:scale-[1.02]"
                  disabled={refreshingId === k.id}
                  onClick={() => onRefresh(k.id)}
                  aria-label={`Refresh KPI ${k.name}`}
                >
                  <RefreshCw
                    className={cn(
                      "mr-2 h-4 w-4",
                      refreshingId === k.id && "animate-spin",
                    )}
                  />
                  Refresh
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
